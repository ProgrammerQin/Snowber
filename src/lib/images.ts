import sharp from "sharp";
import exifReader from "exif-reader";
import { APP_TIMEZONE } from "./config";
import { zonedTimeToUtc } from "./time";

// Photo processing pipeline (advanced feature: file handling and processing).
//
//  1. verify the upload really is an image (sharp decodes it; we check the format),
//  2. read the EXIF capture time before metadata is removed,
//  3. auto-rotate using the EXIF orientation,
//  4. strip all metadata, including GPS coordinates (sharp drops metadata by default),
//  5. produce a display version and a thumbnail as WebP,
//  6. on completion, render a timestamped side-by-side before/after comparison.

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

export class ImageRejectedError extends Error {}

export type ProcessedPhoto = {
  display: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  takenAt: Date | null;
  sourceFormat: string;
};

export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  let metadata: SharpMetadata;
  try {
    metadata = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new ImageRejectedError("That file is not a readable image.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new ImageRejectedError("Use a JPEG, PNG or WebP photo.");
  }
  if ((metadata.width ?? 0) < 200 || (metadata.height ?? 0) < 200) {
    throw new ImageRejectedError("That photo is too small. Use the camera at full size.");
  }

  const takenAt = readCaptureTime(metadata.exif);

  // .rotate() with no argument applies the EXIF orientation; output has no metadata.
  const oriented = sharp(input, { failOn: "error" }).rotate();
  const display = await oriented
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await oriented.clone().resize({ width: 480, height: 360, fit: "cover" }).webp({ quality: 70 }).toBuffer();

  return {
    display: display.data,
    thumb,
    width: display.info.width,
    height: display.info.height,
    takenAt,
    sourceFormat: metadata.format,
  };
}

/**
 * EXIF stores the camera's local wall-clock time without a zone (exif-reader returns
 * it as if it were UTC). Use OffsetTimeOriginal when the camera wrote one; otherwise
 * assume the photo was taken in the app's time zone.
 */
export function readCaptureTime(exif: Buffer | undefined, timeZone = APP_TIMEZONE): Date | null {
  if (!exif) return null;
  try {
    const tags = exifReader(exif);
    const wallClock = tags.Photo?.DateTimeOriginal ?? tags.Photo?.DateTimeDigitized ?? tags.Image?.DateTime;
    if (!(wallClock instanceof Date) || Number.isNaN(wallClock.getTime())) return null;
    const offset = String(tags.Photo?.OffsetTimeOriginal ?? tags.Photo?.OffsetTime ?? "").match(/^([+-])(\d{2}):?(\d{2})$/);
    if (offset) {
      const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "-" ? -1 : 1);
      return new Date(wallClock.getTime() - minutes * 60 * 1000);
    }
    return zonedTimeToUtc(
      {
        year: wallClock.getUTCFullYear(),
        month: wallClock.getUTCMonth() + 1,
        day: wallClock.getUTCDate(),
        hour: wallClock.getUTCHours(),
        minute: wallClock.getUTCMinutes(),
        second: wallClock.getUTCSeconds(),
      },
      timeZone,
    );
  } catch {
    return null;
  }
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Side-by-side proof-of-service image stored with the job. */
export async function renderComparison(
  before: Buffer,
  after: Buffer,
  labels: { before: string; after: string; title: string },
): Promise<Buffer> {
  const panelW = 800;
  const panelH = 600;
  const header = 64;
  const [b, a] = await Promise.all([
    sharp(before).resize(panelW, panelH, { fit: "cover" }).toBuffer(),
    sharp(after).resize(panelW, panelH, { fit: "cover" }).toBuffer(),
  ]);
  const overlay = Buffer.from(`
<svg width="${panelW * 2}" height="${panelH + header}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${panelW * 2}" height="${header}" fill="#0f2a4a"/>
  <text x="24" y="41" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">${escapeXml(labels.title)}</text>
  <rect x="16" y="${header + 16}" rx="8" ry="8" width="${Math.min(700, 30 + labels.before.length * 13)}" height="44" fill="#000000" fill-opacity="0.6"/>
  <text x="32" y="${header + 46}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff">${escapeXml(labels.before)}</text>
  <rect x="${panelW + 16}" y="${header + 16}" rx="8" ry="8" width="${Math.min(700, 30 + labels.after.length * 13)}" height="44" fill="#000000" fill-opacity="0.6"/>
  <text x="${panelW + 32}" y="${header + 46}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff">${escapeXml(labels.after)}</text>
  <rect x="${panelW - 2}" y="${header}" width="4" height="${panelH}" fill="#ffffff"/>
</svg>`);

  return sharp({ create: { width: panelW * 2, height: panelH + header, channels: 3, background: "#0f2a4a" } })
    .composite([
      { input: b, left: 0, top: header },
      { input: a, left: panelW, top: header },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
