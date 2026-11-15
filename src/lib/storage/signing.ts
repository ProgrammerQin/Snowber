import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC signatures for the local storage driver's upload and download URLs.

function secret(): string {
  return process.env.STORAGE_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET || "snowber-dev-only-secret";
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verify(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Expiry rounded up to a bucket boundary, so the same object keeps the same URL
 * for a while and browsers can reuse cached images across live refreshes.
 */
export function bucketedExpiry(expiresInSeconds: number, bucketSeconds = 300): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((now + expiresInSeconds) / bucketSeconds) * bucketSeconds;
}
