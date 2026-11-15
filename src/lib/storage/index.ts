import path from "node:path";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageAdapter } from "./types";

export { storageKeys, contentTypeForKey } from "./types";
export type { StorageAdapter, UploadTarget } from "./types";

const globalForStorage = globalThis as unknown as { __snowberStorage?: StorageAdapter };

/** STORAGE_DRIVER=s3 uses DigitalOcean Spaces; anything else uses the local disk driver. */
export function getStorage(): StorageAdapter {
  if (!globalForStorage.__snowberStorage) {
    globalForStorage.__snowberStorage =
      process.env.STORAGE_DRIVER === "s3"
        ? S3Storage.fromEnv()
        : new LocalStorage(path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_STORAGE_DIR || ".storage"));
  }
  return globalForStorage.__snowberStorage;
}

/**
 * The local driver, or null when using S3. Checks `driver` rather than `instanceof`:
 * route handlers and server actions are bundled separately, so the singleton on
 * globalThis may have been created by a different copy of the class.
 */
export function getLocalStorage(): LocalStorage | null {
  const storage = getStorage();
  return storage.driver === "local" ? (storage as LocalStorage) : null;
}
