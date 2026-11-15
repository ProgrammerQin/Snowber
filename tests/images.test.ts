import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageRejectedError, processPhoto, readCaptureTime, renderComparison } from "@/lib/images";

const svg = (fill: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="${fill}"/></svg>`);

async function jpegWithExif(dateTimeOriginal: string, offset?: string) {
  return sharp(svg("#cfd8e3"))
    .jpeg()
    .withExif({
      IFD0: { Make: "TestPhone" },
      IFD2: { DateTimeOriginal: dateTimeOriginal, ...(offset ? { OffsetTimeOriginal: offset } : {}) },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 39/1 56/1", GPSLongitudeRef: "W", GPSLongitude: "79/1 24/1 41/1" },
    })
    .toBuffer();
}

describe("processPhoto", () => {
  it("strips EXIF (including GPS), resizes and keeps the capture time", async () => {
    const input = await jpegWithExif("2026:11:07 06:30:00");
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processPhoto(input);
    const display = await sharp(result.display).metadata();
    expect(display.format).toBe("webp");
    expect(display.exif).toBeUndefined();
    expect((await sharp(result.thumb).metadata()).width).toBe(480);
    // 06:30 on a Toronto phone in November is 11:30 UTC.
    expect(result.takenAt?.toISOString()).toBe("2026-11-07T11:30:00.000Z");
  });

  it("uses the camera's offset tag when present", async () => {
    const exif = (await sharp(await jpegWithExif("2026:11:07 06:30:00", "-08:00")).metadata()).exif;
    expect(readCaptureTime(exif, "America/Toronto")?.toISOString()).toBe("2026-11-07T14:30:00.000Z");
  });

  it("rejects files that are not images or are too small", async () => {
    await expect(processPhoto(Buffer.from("definitely not an image"))).rejects.toBeInstanceOf(ImageRejectedError);
    const tiny = await sharp(svg("#000")).resize(50, 50).png().toBuffer();
    await expect(processPhoto(tiny)).rejects.toBeInstanceOf(ImageRejectedError);
  });

  it("renders a side-by-side comparison", async () => {
    const a = await sharp(svg("#ffffff")).jpeg().toBuffer();
    const b = await sharp(svg("#333333")).jpeg().toBuffer();
    const image = await renderComparison(a, b, { title: "Test", before: "BEFORE", after: "AFTER" });
    const meta = await sharp(image).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1600);
  });
});
