import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTO_CONFIRM_HOURS } from "@/lib/config";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/contracts/domain";
import { checkTransition, type Actor } from "@/lib/contracts/job-states";
import type { BookingInput } from "@/lib/contracts/schemas";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { publish, publishAll, type PendingEvent } from "@/lib/events";
import { firstName, formatMoney, formatWindow } from "@/lib/format";
import { getPaymentProvider } from "@/lib/payments";
import { cleanerPayout, quote, quoteForWindows } from "@/lib/pricing";
import { signedUrl, toPhotoViews } from "./media";
import { ratingSummary } from "./reviews";
import { actorOf, assertRole, type CurrentUser } from "./session";

type Tx = Prisma.TransactionClient;

// ───────────────────────── State machine ─────────────────────────

export type TransitionExtras = {
  assignment?: { cleanerId: string; windowId: string };
  disputeReason?: string;
};

export type TransitionOutcome = {
  event: PendingEvent;
  refund?: { externalId: string | null; amountCents: number };
};

/**
 * The only code that changes a job's status. Runs inside a transaction:
 * validates the transition and its preconditions, writes the status, timestamps,
 * ledger and payment rows, and returns the event to publish after commit.
 * Uses a compare-and-set update so two concurrent requests cannot both win.
 */
export async function applyTransition(
  tx: Tx,
  jobId: string,
  to: JobStatus,
  actor: Actor,
  extras: TransitionExtras = {},
): Promise<TransitionOutcome> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: {
      photos: { select: { kind: true } },
      payment: true,
      property: { select: { lotSize: true, address: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!job) throw notFound("That job no longer exists.");

  const check = checkTransition(
    {
      status: job.status,
      homeownerId: job.homeownerId,
      cleanerId: job.cleanerId,
      hasBeforePhoto: job.photos.some((p) => p.kind === "BEFORE"),
      hasAfterPhoto: job.photos.some((p) => p.kind === "AFTER"),
    },
    to,
    actor,
  );
  if (!check.ok) throw invalid(check.reason);

  const now = new Date();
  const data: Prisma.JobUncheckedUpdateManyInput = { status: to };
  const audience = new Set<string>([job.homeownerId]);
  if (job.cleanerId) audience.add(job.cleanerId);
  let refund: TransitionOutcome["refund"];
  let message = `${job.property.address}: ${JOB_STATUS_LABEL[to].toLowerCase()}`;

  switch (to) {
    case "ASSIGNED": {
      const assignment = extras.assignment;
      if (!assignment) throw invalid("Missing assignment details.");
      // Sequential on purpose: a transaction uses one connection, which runs one query at a time.
      const window = await tx.serviceWindow.findUnique({ where: { id: assignment.windowId } });
      const cleaner = await tx.user.findUnique({ where: { id: assignment.cleanerId }, select: { role: true, name: true } });
      if (!window) throw notFound("That window no longer exists.");
      if (!cleaner || cleaner.role !== "CLEANER") throw invalid("Jobs can only be assigned to cleaners.");
      Object.assign(data, { cleanerId: assignment.cleanerId, assignedWindowId: window.id, assignedAt: now });
      audience.add(assignment.cleanerId);
      message = `${job.property.address}: assigned to ${firstName(cleaner.name)} for ${formatWindow(window.startsAt, window.endsAt)}`;

      // Homeowners were charged for their most expensive window; refund the difference
      // if the controller picked a cheaper one.
      const assignedPrice = quote({
        lotSize: job.property.lotSize,
        includeSidewalk: job.includeSidewalk,
        includeSalt: job.includeSalt,
        multiplierBps: window.multiplierBps,
      }).totalCents;
      if (assignedPrice < job.priceCents && job.payment) {
        const difference = job.priceCents - assignedPrice;
        data.priceCents = assignedPrice;
        await tx.payment.update({
          where: { id: job.payment.id },
          data: { refundedCents: { increment: difference }, status: "PARTIALLY_REFUNDED" },
        });
        refund = { externalId: job.payment.externalId, amountCents: difference };
        message += ` (price lowered by ${formatMoney(difference)})`;
      }
      break;
    }
    case "REQUESTED":
      Object.assign(data, { cleanerId: null, assignedWindowId: null, routeOrder: null, assignedAt: null });
      message = `${job.property.address}: back in the queue`;
      break;
    case "IN_PROGRESS":
      data.startedAt = now;
      message = `${job.property.address}: ${firstName(job.cleaner?.name ?? "Your cleaner")} started`;
      break;
    case "COMPLETED":
      data.completedAt = now;
      message = `${job.property.address}: done — before/after photos are ready`;
      break;
    case "CONFIRMED": {
      if (!job.cleanerId) throw invalid("This job has no cleaner to pay.");
      data.confirmedAt = now;
      const earning = cleanerPayout(job.priceCents) + job.tipCents;
      await tx.ledgerEntry.create({
        data: {
          cleanerId: job.cleanerId,
          type: "EARNING",
          amountCents: earning,
          jobId: job.id,
          description: `${job.property.address}${job.tipCents > 0 ? ` (incl. ${formatMoney(job.tipCents)} tip)` : ""}`,
        },
      });
      message =
        actor.kind === "system"
          ? `${job.property.address}: auto-confirmed after ${AUTO_CONFIRM_HOURS} hours`
          : `${job.property.address}: confirmed`;
      break;
    }
    case "DISPUTED":
      data.disputeReason = extras.disputeReason ?? null;
      message = `${job.property.address}: disputed by the homeowner`;
      break;
    case "CANCELLED": {
      data.cancelledAt = now;
      if (job.payment && job.payment.status !== "REFUNDED") {
        const remaining = job.payment.amountCents - job.payment.refundedCents;
        await tx.payment.update({
          where: { id: job.payment.id },
          data: { refundedCents: job.payment.amountCents, status: "REFUNDED" },
        });
        if (remaining > 0) refund = { externalId: job.payment.externalId, amountCents: remaining };
      }
      message = `${job.property.address}: cancelled and refunded`;
      break;
    }
  }

  const result = await tx.job.updateMany({ where: { id: jobId, status: job.status }, data });
  if (result.count !== 1) throw conflict("Someone else just updated this job. Refresh and try again.");

  return {
    event: { type: "job.updated", jobId, status: to, message, audience: { userIds: [...audience], controllers: true } },
    refund,
  };
}

/** Runs refunds and publishes events once the transaction has committed. */
export async function settleOutcomes(outcomes: readonly TransitionOutcome[]): Promise<void> {
  const provider = getPaymentProvider();
  for (const outcome of outcomes) {
    if (!outcome.refund) continue;
    try {
      await provider.refund(outcome.refund);
    } catch (error) {
      console.error("[payments] refund failed; needs a retry", error);
    }
  }
  publishAll(outcomes.map((o) => o.event));
}

export async function transitionJob(jobId: string, to: JobStatus, actor: Actor, extras?: TransitionExtras) {
  const outcome = await prisma.$transaction((tx) => applyTransition(tx, jobId, to, actor, extras));
  await settleOutcomes([outcome]);
  return outcome;
}

// ───────────────────────── Homeowner ─────────────────────────

export async function previewQuote(
  user: CurrentUser,
  input: Pick<BookingInput, "propertyId" | "windowIds" | "includeSidewalk" | "includeSalt">,
) {
  assertRole(user, "HOMEOWNER");
  const property = await prisma.property.findFirst({ where: { id: input.propertyId, ownerId: user.id } });
  if (!property) throw notFound("Choose one of your properties.");
  const windows = await prisma.serviceWindow.findMany({
    where: { id: { in: input.windowIds }, status: "OPEN", startsAt: { gt: new Date() } },
  });
  if (windows.length === 0) throw invalid("Pick at least one open window.");
  return quoteForWindows(
    { lotSize: property.lotSize, includeSidewalk: property.hasSidewalk && input.includeSidewalk, includeSalt: input.includeSalt },
    windows.map((w) => w.multiplierBps),
  );
}

/** Creates the job and a (mock) payment in one transaction, then tells the controller. */
export async function createBooking(user: CurrentUser, input: BookingInput) {
  assertRole(user, "HOMEOWNER");
  const property = await prisma.property.findFirst({ where: { id: input.propertyId, ownerId: user.id } });
  if (!property) throw notFound("Choose one of your properties.");

  const windowIds = [...new Set(input.windowIds)];
  const windows = await prisma.serviceWindow.findMany({
    where: { id: { in: windowIds }, status: "OPEN", startsAt: { gt: new Date() } },
  });
  if (windows.length !== windowIds.length) {
    throw invalid("One of those windows has closed or already started. Please pick again.");
  }

  const includeSidewalk = property.hasSidewalk && input.includeSidewalk;
  const q = quoteForWindows(
    { lotSize: property.lotSize, includeSidewalk, includeSalt: input.includeSalt },
    windows.map((w) => w.multiplierBps),
  );
  const totalCharge = q.totalCents + input.tipCents;
  const provider = getPaymentProvider();

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        propertyId: property.id,
        homeownerId: user.id,
        includeSidewalk,
        includeSalt: input.includeSalt,
        notes: input.notes,
        priceCents: q.totalCents,
        tipCents: input.tipCents,
        estMinutes: q.estMinutes,
        requiresBlower: q.requiresBlower,
        windowOptions: { connect: windows.map((w) => ({ id: w.id })) },
      },
    });
    const charge = await provider.charge({
      jobId: created.id,
      amountCents: totalCharge,
      description: `Snow clearing at ${property.address}`,
    });
    await tx.payment.create({
      data: { jobId: created.id, provider: provider.name, externalId: charge.externalId, amountCents: totalCharge },
    });
    return created;
  });

  publish({
    type: "job.created",
    jobId: job.id,
    status: "REQUESTED",
    message: `New request: ${property.address}`,
    audience: { userIds: [user.id], controllers: true },
  });
  return job;
}

export async function listHomeownerJobs(user: CurrentUser) {
  assertRole(user, "HOMEOWNER");
  return prisma.job.findMany({
    where: { homeownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      property: { select: { address: true, label: true } },
      assignedWindow: true,
      windowOptions: { orderBy: { startsAt: "asc" } },
      cleaner: { select: { name: true } },
    },
  });
}

export async function getHomeownerJob(user: CurrentUser, jobId: string) {
  assertRole(user, "HOMEOWNER");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      property: true,
      assignedWindow: true,
      windowOptions: { orderBy: { startsAt: "asc" } },
      cleaner: { select: { id: true, name: true } },
      photos: { orderBy: { createdAt: "asc" } },
      reviews: true,
      payment: true,
    },
  });
  if (!job || job.homeownerId !== user.id) throw notFound("We couldn't find that job.");
  const [photos, comparisonUrl, cleanerRating] = await Promise.all([
    toPhotoViews(job.photos),
    signedUrl(job.comparisonKey),
    job.cleaner ? ratingSummary([job.cleaner.id]).then((r) => r.get(job.cleaner!.id) ?? null) : Promise.resolve(null),
  ]);
  return {
    ...job,
    photos,
    comparisonUrl,
    cleanerRating,
    myReview: job.reviews.find((r) => r.authorId === user.id) ?? null,
  };
}

export async function cancelJob(user: CurrentUser, jobId: string) {
  assertRole(user, "HOMEOWNER", "CONTROLLER");
  return transitionJob(jobId, "CANCELLED", actorOf(user));
}

export async function confirmJob(user: CurrentUser, jobId: string) {
  assertRole(user, "HOMEOWNER", "CONTROLLER");
  return transitionJob(jobId, "CONFIRMED", actorOf(user));
}

export async function disputeJob(user: CurrentUser, jobId: string, reason: string) {
  assertRole(user, "HOMEOWNER");
  return transitionJob(jobId, "DISPUTED", actorOf(user), { disputeReason: reason });
}

export async function resolveDispute(user: CurrentUser, jobId: string, outcome: "pay-cleaner" | "refund") {
  assertRole(user, "CONTROLLER");
  return transitionJob(jobId, outcome === "pay-cleaner" ? "CONFIRMED" : "CANCELLED", actorOf(user));
}

/** Confirms jobs the homeowner has not responded to within AUTO_CONFIRM_HOURS. */
export async function autoConfirmStale(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_CONFIRM_HOURS * 60 * 60 * 1000);
  const stale = await prisma.job.findMany({
    where: { status: "COMPLETED", completedAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  let confirmed = 0;
  for (const { id } of stale) {
    try {
      await transitionJob(id, "CONFIRMED", { kind: "system" });
      confirmed++;
    } catch {
      // Another request confirmed or disputed it first; nothing to do.
    }
  }
  return confirmed;
}

// ───────────────────────── Cleaner ─────────────────────────

export async function listCleanerJobs(user: CurrentUser) {
  assertRole(user, "CLEANER");
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.job.findMany({
    where: {
      cleanerId: user.id,
      OR: [
        { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        { status: { in: ["COMPLETED", "CONFIRMED", "DISPUTED"] }, completedAt: { gte: weekAgo } },
      ],
    },
    orderBy: [{ assignedWindow: { startsAt: "asc" } }, { routeOrder: "asc" }],
    include: {
      property: { select: { address: true, lat: true, lng: true, lotSize: true, notes: true } },
      assignedWindow: true,
      homeowner: { select: { name: true } },
    },
  });
}

export async function getCleanerJob(user: CurrentUser, jobId: string) {
  assertRole(user, "CLEANER");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      property: true,
      assignedWindow: true,
      homeowner: { select: { id: true, name: true } },
      photos: { orderBy: { createdAt: "asc" } },
      reviews: true,
    },
  });
  if (!job || job.cleanerId !== user.id) throw notFound("That job isn't assigned to you.");
  const [photos, homeownerRating] = await Promise.all([
    toPhotoViews(job.photos),
    ratingSummary([job.homeownerId]).then((r) => r.get(job.homeownerId) ?? null),
  ]);
  return { ...job, photos, homeownerRating, myReview: job.reviews.find((r) => r.authorId === user.id) ?? null };
}

// ───────────────────────── Controller ─────────────────────────

export async function listJobsForController(user: CurrentUser, filter: { status?: JobStatus } = {}) {
  assertRole(user, "CONTROLLER");
  return prisma.job.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      property: { select: { address: true } },
      homeowner: { select: { name: true } },
      cleaner: { select: { name: true } },
      assignedWindow: true,
      windowOptions: { orderBy: { startsAt: "asc" }, take: 1 },
      photos: { where: { flagged: true }, select: { id: true } },
    },
  });
}

export async function getJobForController(user: CurrentUser, jobId: string) {
  assertRole(user, "CONTROLLER");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      property: true,
      homeowner: { select: { id: true, name: true, email: true } },
      cleaner: { select: { id: true, name: true, email: true } },
      assignedWindow: true,
      windowOptions: { orderBy: { startsAt: "asc" } },
      photos: { orderBy: { createdAt: "asc" } },
      reviews: { include: { author: { select: { name: true, role: true } } } },
      payment: true,
      ledgerEntries: true,
    },
  });
  if (!job) throw notFound("We couldn't find that job.");
  const [photos, comparisonUrl] = await Promise.all([toPhotoViews(job.photos), signedUrl(job.comparisonKey)]);
  return { ...job, photos, comparisonUrl };
}

/** Guards used by pages that only need to know whether a job exists for this user. */
export function ensureCanView(user: CurrentUser, job: { homeownerId: string; cleanerId: string | null }) {
  if (user.role === "CONTROLLER") return;
  if (user.role === "HOMEOWNER" && job.homeownerId === user.id) return;
  if (user.role === "CLEANER" && job.cleanerId === user.id) return;
  throw forbidden();
}
