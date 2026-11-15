import "server-only";
import { prisma } from "@/lib/prisma";
import { conflict, invalid, notFound } from "@/lib/errors";
import { isUniqueViolation } from "@/lib/errors";
import { publish } from "@/lib/events";
import { assertRole, type CurrentUser } from "./session";

export type RatingSummary = { average: number; count: number };

/** Average rating received per user. */
export async function ratingSummary(userIds: readonly string[]): Promise<Map<string, RatingSummary>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.review.groupBy({
    by: ["subjectId"],
    where: { subjectId: { in: [...userIds] } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [r.subjectId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]),
  );
}

/**
 * Two-way reviews after a confirmed job: the homeowner rates the cleaner and the
 * cleaner rates the house (e.g. inaccurate lot size, unsafe steps). One per author.
 */
export async function createReview(user: CurrentUser, input: { jobId: string; rating: number; comment?: string }) {
  assertRole(user, "HOMEOWNER", "CLEANER");
  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) throw notFound("We couldn't find that job.");

  let subjectId: string;
  if (user.role === "HOMEOWNER") {
    if (job.homeownerId !== user.id) throw notFound("We couldn't find that job.");
    if (!job.cleanerId) throw invalid("This job has no cleaner to review.");
    subjectId = job.cleanerId;
  } else {
    if (job.cleanerId !== user.id) throw notFound("We couldn't find that job.");
    subjectId = job.homeownerId;
  }
  if (job.status !== "CONFIRMED") throw invalid("You can leave a review once the job is confirmed.");

  try {
    const review = await prisma.review.create({
      data: { jobId: job.id, authorId: user.id, subjectId, rating: input.rating, comment: input.comment },
    });
    publish({
      type: "job.updated",
      jobId: job.id,
      message: `New ${input.rating}-star review`,
      audience: { userIds: [subjectId], controllers: true },
    });
    return review;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("You already reviewed this job.");
    throw error;
  }
}
