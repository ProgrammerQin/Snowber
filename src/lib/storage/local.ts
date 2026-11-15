import { promises as fs } from "node:fs";
import path from "node:path";
import { bucketedExpiry, sign } from "./signing";
import type { StorageAdapter, UploadTarget } from "./types";

/**
 * Development driver: stores objects on disk and issues HMAC-signed URLs that are
 * served by /api/storage/upload (PUT) and /api/storage/file (GET). It mirrors the
 * presigned-URL flow of the S3 driver, so the client code is identical.
 */
export class LocalStorage implements StorageAdapter {
  readonly driver = "local" as const;

  constructor(private readonly root: string) {}

  resolve(key: string): string {
    if (!/^[A-Za-z0-9/_\-.]+$/.test(key) || key.includes("..") || key.startsWith("/")) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path.join(this.root, key);
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    options: { maxBytes?: number; expiresInSeconds?: number } = {},
  ): Promise<UploadTarget> {
    this.resolve(key);
    const exp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 600);
    const max = options.maxBytes ?? 15 * 1024 * 1024;
    const sig = sign(LocalStorage.uploadPayload(key, contentType, exp, max));
    const params = new URLSearchParams({ key, ct: contentType, exp: String(exp), max: String(max), sig });
    return { url: `/api/storage/upload?${params}`, method: "PUT", headers: { "Content-Type": contentType } };
  }

  async getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    this.resolve(key);
    const exp = bucketedExpiry(expiresInSeconds);
    const sig = sign(LocalStorage.downloadPayload(key, exp));
    return `/api/storage/file?${new URLSearchParams({ key, exp: String(exp), sig })}`;
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  static uploadPayload(key: string, contentType: string, exp: number, max: number) {
    return `put\n${key}\n${contentType}\n${exp}\n${max}`;
  }

  static downloadPayload(key: string, exp: number) {
    return `get\n${key}\n${exp}`;
  }
}
