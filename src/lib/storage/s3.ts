import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, UploadTarget } from "./types";

/**
 * DigitalOcean Spaces (or any S3-compatible service). The bucket stays private:
 * browsers upload with presigned PUT URLs and view images through presigned GET URLs.
 */
export class S3Storage implements StorageAdapter {
  readonly driver = "s3" as const;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  static fromEnv(): S3Storage {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }
    const client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined, // e.g. https://tor1.digitaloceanspaces.com
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
      // Newer AWS SDKs add CRC32 checksums to every upload by default; S3-compatible
      // services and browser PUTs to presigned URLs work best with checksums only when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    return new S3Storage(client, bucket);
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    options: { expiresInSeconds?: number } = {},
  ): Promise<UploadTarget> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds ?? 600 });
    return { url, method: "PUT", headers: { "Content-Type": contentType } };
  }

  async getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    // A stable signing time (5-minute buckets) keeps URLs identical between live refreshes,
    // so browsers reuse cached images instead of downloading them again.
    const bucketMs = 5 * 60 * 1000;
    const signingDate = new Date(Math.floor(Date.now() / bucketMs) * bucketMs);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds + 300, signingDate });
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ACL: "private" }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
