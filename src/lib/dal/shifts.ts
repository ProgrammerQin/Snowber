import "server-only";
import { prisma } from "@/lib/prisma";
import { conflict, invalid, isExclusionViolation, notFound } from "@/lib/errors";
import { publish } from "@/lib/events";
import { assertRole, type CurrentUser } from "./session";

// Cleaners book the hours they can work. Overlapping shifts are rejected by the
// "Shift_no_overlap" exclusion constraint in PostgreSQL, not only by this code.

export async function listMyShifts(user: CurrentUser) {
  assertRole(user, "CLEANER");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.shift.findMany({ where: { cleanerId: user.id, endsAt: { gte: since } }, orderBy: { startsAt: "asc" } });
}

export async function createShift(user: CurrentUser, input: { startsAt: Date; endsAt: Date }) {
  assertRole(user, "CLEANER");
  if (input.endsAt.getTime() <= Date.now()) throw invalid("That shift is already over.");
  try {
    const shift = await prisma.shift.create({ data: { cleanerId: user.id, startsAt: input.startsAt, endsAt: input.endsAt } });
    publish({ type: "dispatch.updated", message: `${user.name} posted a shift`, audience: { userIds: [], controllers: true } });
    return shift;
  } catch (error) {
    if (isExclusionViolation(error, "Shift_no_overlap")) throw conflict("This shift overlaps one you already posted.");
    throw error;
  }
}

export async function deleteShift(user: CurrentUser, shiftId: string) {
  assertRole(user, "CLEANER");
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.cleanerId !== user.id) throw notFound("We couldn't find that shift.");
  const booked = await prisma.job.count({
    where: {
      cleanerId: user.id,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      assignedWindow: { startsAt: { lt: shift.endsAt }, endsAt: { gt: shift.startsAt } },
    },
  });
  if (booked > 0) throw conflict("You have jobs assigned during this shift. Ask the controller to reassign them first.");
  await prisma.shift.delete({ where: { id: shiftId } });
  publish({ type: "dispatch.updated", audience: { userIds: [], controllers: true } });
}
