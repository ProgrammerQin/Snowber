import "server-only";
import { prisma } from "@/lib/prisma";
import { invalid } from "@/lib/errors";
import { publish } from "@/lib/events";
import { formatMoney } from "@/lib/format";
import { cleanerPayout } from "@/lib/pricing";
import { assertRole, type CurrentUser } from "./session";

// A cleaner's balance is the sum of an append-only ledger: earnings (+),
// rental fees (−) and payouts (−). Nothing is ever edited in place.

export async function getMyLedger(user: CurrentUser) {
  assertRole(user, "CLEANER");
  const [entries, balance, pending] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { cleanerId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ledgerEntry.aggregate({ where: { cleanerId: user.id }, _sum: { amountCents: true } }),
    prisma.job.findMany({
      where: { cleanerId: user.id, status: { in: ["COMPLETED", "DISPUTED"] } },
      select: { id: true, priceCents: true, tipCents: true, status: true, property: { select: { address: true } } },
    }),
  ]);
  return {
    entries,
    balanceCents: balance._sum.amountCents ?? 0,
    pending: pending.map((j) => ({ ...j, expectedCents: cleanerPayout(j.priceCents) + j.tipCents })),
  };
}

/** Simulated payout of the full balance (no real money moves in the course build). */
export async function requestPayout(user: CurrentUser) {
  assertRole(user, "CLEANER");
  const entry = await prisma.$transaction(async (tx) => {
    // Lock this cleaner's ledger rows so two payout clicks can't both pay out.
    await tx.$queryRaw`SELECT id FROM "LedgerEntry" WHERE "cleanerId" = ${user.id} FOR UPDATE`;
    const { _sum } = await tx.ledgerEntry.aggregate({ where: { cleanerId: user.id }, _sum: { amountCents: true } });
    const balance = _sum.amountCents ?? 0;
    if (balance <= 0) throw invalid("There's nothing to pay out yet.");
    return tx.ledgerEntry.create({
      data: { cleanerId: user.id, type: "PAYOUT", amountCents: -balance, description: "Payout to your bank account (simulated)" },
    });
  });
  publish({
    type: "ledger.updated",
    message: `Payout of ${formatMoney(-entry.amountCents)} sent`,
    audience: { userIds: [user.id], controllers: false },
  });
  return entry;
}
