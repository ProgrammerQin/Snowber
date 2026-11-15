/**
 * One-time setup for the DigitalOcean Spaces bucket (STORAGE_DRIVER=s3):
 *  - CORS so browsers can PUT photos to presigned URLs and GET them back,
 *  - a lifecycle rule that deletes raw uploads that were never processed.
 *
 *   APP_ORIGIN=https://your-app.example npm run storage:configure
 */
import "dotenv/config";
import { PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  console.error("Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (and S3_ENDPOINT for Spaces) first.");
  process.exit(1);
}

const origins = (process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").split(",").map((o) => o.trim());
const client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        { AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
      ],
    },
  }),
);
console.log(`CORS set for ${origins.join(", ")}`);

await client.send(
  new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: {
      Rules: [{ ID: "expire-unprocessed-uploads", Status: "Enabled", Filter: { Prefix: "raw/" }, Expiration: { Days: 1 } }],
    },
  }),
);
console.log('Lifecycle rule set: objects under "raw/" expire after 1 day.');
