import "server-only";
import { prisma } from "@/lib/prisma";
import { JOB_STATUSES, type JobStatus } from "@/lib/contracts/domain";
import { autoConfirmStale } from "./jobs";
import { assertRole, type CurrentUser } from "./session";

/** Numbers for the controller's overview page. Also runs the 24-hour auto-confirm. */
export async function getControllerOverview(user: CurrentUser) {
  assertRole(user, "CONTROLLER");
  await autoConfirmStale();
  const now = new Date();
  const [byStatus, pendingRentals, flaggedPhotos, upcomingWindows, recentJobs, cleanersOnShift] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.toolRental.count({ where: { status: "REQUESTED" } }),
    prisma.jobPhoto.count({ where: { flagged: true, job: { status: { in: ["COMPLETED", "DISPUTED"] } } } }),
    prisma.serviceWindow.findMany({
      where: { endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { _count: { select: { optionJobs: true, assignedJobs: true } } },
    }),
    prisma.job.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { property: { select: { address: true } }, cleaner: { select: { name: true } } },
    }),
    prisma.shift.findMany({
      where: { endsAt: { gte: now }, startsAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
      distinct: ["cleanerId"],
      select: { cleanerId: true },
    }),
  ]);
  const counts = Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const row of byStatus) counts[row.status] = row._count._all;
  return { counts, pendingRentals, flaggedPhotos, upcomingWindows, recentJobs, cleanersOnShift: cleanersOnShift.length };
}
