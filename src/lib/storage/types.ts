export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

/**
 * Cloud storage abstraction. The database stores object keys only; browsers get
 * short-lived signed URLs. `s3` targets DigitalOcean Spaces (or any S3 API);
 * `local` writes to disk and serves signed URLs from this app (for development).
 */
export interface StorageAdapter {
  readonly driver: "local" | "s3";
  createUploadUrl(key: string, contentType: string, options?: { maxBytes?: number; expiresInSeconds?: number }): Promise<UploadTarget>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

/** Object key layout. Raw uploads live under raw/ so a lifecycle rule can expire leftovers. */
export const storageKeys = {
  rawPhoto: (jobId: string, kind: string, uploadId: string) => `raw/jobs/${jobId}/${kind.toLowerCase()}-${uploadId}`,
  rawPrefix: (jobId: string) => `raw/jobs/${jobId}/`,
  photoDisplay: (jobId: string, photoId: string) => `jobs/${jobId}/${photoId}-display.webp`,
  photoThumb: (jobId: string, photoId: string) => `jobs/${jobId}/${photoId}-thumb.webp`,
  comparison: (jobId: string) => `jobs/${jobId}/comparison.jpg`,
};

export function contentTypeForKey(key: string): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}
