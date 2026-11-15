import "server-only";
import { prisma } from "@/lib/prisma";
import type { ToolStatus, ToolType } from "@/lib/contracts/domain";
import { conflict, invalid, isExclusionViolation, notFound } from "@/lib/errors";
import { publish } from "@/lib/events";
import { formatMoney } from "@/lib/format";
import { assertRole, type CurrentUser } from "./session";

// Tool library run by the controller. Cleaners request a tool for a time range;
// approving a request charges the fee to the cleaner's ledger. Two approved
// rentals of the same tool can never overlap (PostgreSQL exclusion constraint).
// An approved snow blower rental lets the matcher give that cleaner large lots.

export async function listToolsWithRentals() {
  const now = new Date();
  return prisma.tool.findMany({
    where: { status: { not: "RETIRED" } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      rentals: {
        where: { status: "APPROVED", endsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        include: { cleaner: { select: { name: true } } },
      },
    },
  });
}

export async function listToolsForCleaner(user: CurrentUser) {
  assertRole(user, "CLEANER");
  return listToolsWithRentals();
}

export async function listToolsForController(user: CurrentUser) {
  assertRole(user, "CONTROLLER");
  return prisma.tool.findMany({ orderBy: [{ status: "asc" }, { type: "asc" }, { name: "asc" }] });
}

export async function createTool(user: CurrentUser, input: { name: string; type: ToolType; feeDollars: number; notes?: string }) {
  assertRole(user, "CONTROLLER");
  return prisma.tool.create({ data: { name: input.name, type: input.type, feeCents: input.feeDollars, notes: input.notes } });
}

export async function setToolStatus(user: CurrentUser, toolId: string, status: ToolStatus) {
  assertRole(user, "CONTROLLER");
  await prisma.tool.update({ where: { id: toolId }, data: { status } });
}

export async function requestRental(user: CurrentUser, input: { toolId: string; startsAt: Date; endsAt: Date }) {
  assertRole(user, "CLEANER");
  const tool = await prisma.tool.findUnique({ where: { id: input.toolId } });
  if (!tool || tool.status !== "AVAILABLE") throw invalid("That tool isn't available to rent right now.");
  if (input.endsAt.getTime() <= Date.now()) throw invalid("That time has already passed.");
  const clash = await prisma.toolRental.findFirst({
    where: { toolId: tool.id, status: "APPROVED", startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
  });
  if (clash) throw conflict(`${tool.name} is already rented during that time.`);

  const rental = await prisma.toolRental.create({
    data: { toolId: tool.id, cleanerId: user.id, startsAt: input.startsAt, endsAt: input.endsAt, feeCents: tool.feeCents },
  });
  publish({
    type: "rental.updated",
    message: `${user.name} requested ${tool.name}`,
    audience: { userIds: [user.id], controllers: true },
  });
  return rental;
}

export async function listMyRentals(user: CurrentUser) {
  assertRole(user, "CLEANER");
  return prisma.toolRental.findMany({
    where: { cleanerId: user.id },
    orderBy: { startsAt: "desc" },
    take: 30,
    include: { tool: { select: { name: true, type: true } } },
  });
}

export async function cancelMyRental(user: CurrentUser, rentalId: string) {
  assertRole(user, "CLEANER");
  const rental = await prisma.toolRental.findUnique({ where: { id: rentalId } });
  if (!rental || rental.cleanerId !== user.id) throw notFound("We couldn't find that rental.");
  if (rental.status !== "REQUESTED") throw invalid("Only pending requests can be cancelled. Ask the controller about approved rentals.");
  await prisma.toolRental.update({ where: { id: rentalId }, data: { status: "CANCELLED", decidedAt: new Date() } });
  publish({ type: "rental.updated", audience: { userIds: [user.id], controllers: true } });
}

export async function listRentalsForController(user: CurrentUser) {
  assertRole(user, "CONTROLLER");
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  return prisma.toolRental.findMany({
    where: { OR: [{ status: "REQUESTED" }, { status: "APPROVED", endsAt: { gte: since } }] },
    orderBy: [{ status: "desc" }, { startsAt: "asc" }],
    include: { tool: { select: { name: true, type: true } }, cleaner: { select: { name: true } } },
  });
}

/** Approve (charging the fee) or reject a rental request. */
export async function decideRental(user: CurrentUser, rentalId: string, approve: boolean) {
  assertRole(user, "CONTROLLER");
  const rental = await prisma.toolRental.findUnique({ where: { id: rentalId }, include: { tool: true } });
  if (!rental) throw notFound("We couldn't find that rental.");
  if (rental.status !== "REQUESTED") throw invalid("This request was already handled.");

  if (!approve) {
    await prisma.toolRental.update({ where: { id: rentalId }, data: { status: "REJECTED", decidedAt: new Date() } });
  } else {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.toolRental.updateMany({
          where: { id: rentalId, status: "REQUESTED" },
          data: { status: "APPROVED", decidedAt: new Date() },
        });
        if (updated.count !== 1) throw conflict("This request was already handled.");
        if (rental.feeCents > 0) {
          await tx.ledgerEntry.create({
            data: {
              cleanerId: rental.cleanerId,
              type: "RENTAL_FEE",
              amountCents: -rental.feeCents,
              rentalId: rental.id,
              description: `${rental.tool.name} rental`,
            },
          });
        }
      });
    } catch (error) {
      if (isExclusionViolation(error, "ToolRental_no_overlap")) {
        throw conflict(`${rental.tool.name} is already approved for an overlapping time.`);
      }
      throw error;
    }
  }

  publish({
    type: "rental.updated",
    message: `${rental.tool.name}: request ${approve ? `approved (${formatMoney(rental.feeCents)} fee)` : "declined"}`,
    audience: { userIds: [rental.cleanerId], controllers: true },
  });
}

export async function markRentalReturned(user: CurrentUser, rentalId: string) {
  assertRole(user, "CONTROLLER");
  const rental = await prisma.toolRental.findUnique({ where: { id: rentalId } });
  if (!rental || rental.status !== "APPROVED") throw invalid("Only approved rentals can be marked returned.");
  await prisma.toolRental.update({ where: { id: rentalId }, data: { status: "RETURNED" } });
  publish({ type: "rental.updated", audience: { userIds: [rental.cleanerId], controllers: true } });
}
