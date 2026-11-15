import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES, PHOTO_FLAG_HOURS, type AllowedImageType } from "@/lib/config";
import type { PhotoKind } from "@/lib/contracts/domain";
import { invalid, notFound } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ImageRejectedError, processPhoto, renderComparison } from "@/lib/images";
import { getStorage, storageKeys } from "@/lib/storage";
import { transitionJob } from "./jobs";
import { actorOf, assertRole, type CurrentUser } from "./session";

// Before/after photo flow:
//  1. createPhotoUpload: checks the cleaner is assigned and the job is in the right
//     state, then returns a presigned PUT URL under raw/ (the browser uploads directly).
//  2. finalizePhoto: downloads the raw object, runs the sharp pipeline, stores the
//     display and thumbnail versions, deletes the raw upload, records a JobPhoto,
//     and moves the job forward (before photo starts it, after photo completes it).

const REQUIRED_STATUS: Record<PhotoKind, "ASSIGNED" | "IN_PROGRESS"> = {
  BEFORE: "ASSIGNED",
  AFTER: "IN_PROGRESS",
};

async function loadJobForUpload(user: CurrentUser, jobId: string, kind: PhotoKind) {
  assertRole(user, "CLEANER");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assignedWindow: true, property: { select: { address: true } } },
  });
  if (!job || job.cleanerId !== user.id) throw notFound("That job isn't assigned to you.");
  if (job.status !== REQUIRED_STATUS[kind]) {
    throw invalid(
      kind === "BEFORE"
        ? "Before photos are taken when the job is assigned and not yet started."
        : "After photos are taken while the job is in progress.",
    );
  }
  return job;
}

export async function createPhotoUpload(
  user: CurrentUser,
  input: { jobId: string; kind: PhotoKind; contentType: AllowedImageType; size: number },
) {
  await loadJobForUpload(user, input.jobId, input.kind);
  const key = storageKeys.rawPhoto(input.jobId, input.kind, randomUUID());
  const target = await getStorage().createUploadUrl(key, input.contentType, { maxBytes: MAX_UPLOAD_BYTES, expiresInSeconds: 600 });
  return { key, ...target };
}

export async function finalizePhoto(user: CurrentUser, input: { jobId: string; kind: PhotoKind; key: string }) {
  const job = await loadJobForUpload(user, input.jobId, input.kind);
  if (!input.key.startsWith(storageKeys.rawPrefix(job.id))) throw invalid("That upload doesn't belong to this job.");

  const storage = getStorage();
  let raw: Buffer;
  try {
    raw = await storage.getObject(input.key);
  } catch {
    throw invalid("We couldn't find the uploaded photo. Please try again.");
  }
  if (raw.length > MAX_UPLOAD_BYTES) {
    await storage.deleteObject(input.key);
    throw invalid("Photos must be under 15 MB.");
  }

  let processed;
  try {
    processed = await processPhoto(raw);
  } catch (error) {
    await storage.deleteObject(input.key).catch(() => undefined);
    if (error instanceof ImageRejectedError) throw invalid(error.message);
    throw error;
  }

  // Flag photos whose capture time doesn't fit the job (possible reuse of an old photo).
  let flagReason: string | null = null;
  if (processed.takenAt && job.assignedWindow) {
    const earliest = job.assignedWindow.startsAt.getTime() - PHOTO_FLAG_HOURS * 60 * 60 * 1000;
    if (processed.takenAt.getTime() < earliest) {
      flagReason = `Camera says this photo was taken ${formatDateTime(processed.takenAt)}, more than ${PHOTO_FLAG_HOURS} hours before the window.`;
    } else if (processed.takenAt.getTime() > Date.now() + 60 * 60 * 1000) {
      flagReason = "Camera capture time is in the future.";
    }
  }

  const photoId = randomUUID().replace(/-/g, "");
  const displayKey = storageKeys.photoDisplay(job.id, photoId);
  const thumbKey = storageKeys.photoThumb(job.id, photoId);
  await Promise.all([
    storage.putObject(displayKey, processed.display, "image/webp"),
    storage.putObject(thumbKey, processed.thumb, "image/webp"),
  ]);
  await storage.deleteObject(input.key).catch(() => undefined);

  await prisma.jobPhoto.create({
    data: {
      id: photoId,
      jobId: job.id,
      kind: input.kind,
      displayKey,
      thumbKey,
      width: processed.width,
      height: processed.height,
      takenAt: processed.takenAt,
      flagged: flagReason !== null,
      flagReason,
      uploadedById: user.id,
    },
  });

  if (input.kind === "BEFORE") {
    await transitionJob(job.id, "IN_PROGRESS", actorOf(user));
  } else {
    // Render the proof-of-service image first so it's ready when the homeowner is notified.
    await buildComparison(job.id, job.property.address).catch((error) =>
      console.error("[photos] comparison image failed", error),
    );
    await transitionJob(job.id, "COMPLETED", actorOf(user));
  }
  return { photoId, flagged: flagReason !== null };
}

/** Renders the side-by-side image from the first before photo and the latest after photo. */
export async function buildComparison(jobId: string, address: string) {
  const [before, after] = await Promise.all([
    prisma.jobPhoto.findFirst({ where: { jobId, kind: "BEFORE" }, orderBy: { createdAt: "asc" } }),
    prisma.jobPhoto.findFirst({ where: { jobId, kind: "AFTER" }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!before || !after) return null;
  const storage = getStorage();
  const [beforeBuf, afterBuf] = await Promise.all([storage.getObject(before.displayKey), storage.getObject(after.displayKey)]);
  const stamp = (d: Date | null, fallback: Date) => formatDateTime(d ?? fallback);
  const image = await renderComparison(beforeBuf, afterBuf, {
    title: `Snowber · ${address}`,
    before: `BEFORE · ${stamp(before.takenAt, before.createdAt)}`,
    after: `AFTER · ${stamp(after.takenAt, after.createdAt)}`,
  });
  const key = storageKeys.comparison(jobId);
  await storage.putObject(key, image, "image/jpeg");
  await prisma.job.update({ where: { id: jobId }, data: { comparisonKey: key } });
  return key;
}
