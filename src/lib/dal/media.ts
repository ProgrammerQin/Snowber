import "server-only";
import { getStorage } from "@/lib/storage";

// Turns stored object keys into short-lived signed URLs for rendering.
// Callers must have already checked that the viewer may see the job.

export type PhotoView = {
  id: string;
  kind: "BEFORE" | "AFTER";
  width: number;
  height: number;
  takenAt: Date | null;
  createdAt: Date;
  flagged: boolean;
  flagReason: string | null;
  displayUrl: string;
  thumbUrl: string;
};

type StoredPhoto = Omit<PhotoView, "displayUrl" | "thumbUrl"> & { displayKey: string; thumbKey: string };

export async function toPhotoViews(photos: readonly StoredPhoto[]): Promise<PhotoView[]> {
  const storage = getStorage();
  return Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      kind: p.kind,
      width: p.width,
      height: p.height,
      takenAt: p.takenAt,
      createdAt: p.createdAt,
      flagged: p.flagged,
      flagReason: p.flagReason,
      displayUrl: await storage.getDownloadUrl(p.displayKey),
      thumbUrl: await storage.getDownloadUrl(p.thumbKey),
    })),
  );
}

export async function signedUrl(key: string | null | undefined): Promise<string | null> {
  return key ? getStorage().getDownloadUrl(key) : null;
}
