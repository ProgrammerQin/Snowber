// Central place for configuration read from environment variables.
// Values prefixed NEXT_PUBLIC_ are also available in the browser.

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Toronto";

/** Center of the demo neighborhood; used for the map and as a fallback route start. */
export const NEIGHBORHOOD_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_NEIGHBORHOOD_LAT ?? 43.6655),
  lng: Number(process.env.NEXT_PUBLIC_NEIGHBORHOOD_LNG ?? -79.4115),
};

export const DEMO_LOGINS_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGINS === "true";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Completed jobs are confirmed automatically after this many hours without a response. */
export const AUTO_CONFIRM_HOURS = 24;

/** Photos captured this long before the window start are flagged for the controller. */
export const PHOTO_FLAG_HOURS = 12;
