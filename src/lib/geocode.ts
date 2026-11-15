import { NEIGHBORHOOD_CENTER } from "./config";

// Geocoding with OpenStreetMap Nominatim. Its usage policy allows at most one
// request per second and asks clients to cache results, so Snowber geocodes an
// address once (when a property or cleaner home is saved) and stores lat/lng.
//
// GEOCODER=mock skips the network and places addresses deterministically around the
// neighborhood center (useful offline and in tests). If Nominatim fails, the mock
// position is used and the record is marked approximate.

export type GeocodeResult = { lat: number; lng: number; approximate: boolean; displayName?: string };

const cache = new Map<string, GeocodeResult>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const normalized = address.trim().replace(/\s+/g, " ");
  const cached = cache.get(normalized.toLowerCase());
  if (cached) return cached;

  let result: GeocodeResult;
  if (process.env.GEOCODER === "mock") {
    result = mockGeocode(normalized);
  } else {
    try {
      result = (await rateLimited(() => nominatim(normalized))) ?? { ...mockGeocode(normalized), approximate: true };
    } catch (error) {
      console.warn("[geocode] Nominatim failed, using an approximate position:", (error as Error).message);
      result = { ...mockGeocode(normalized), approximate: true };
    }
  }
  cache.set(normalized.toLowerCase(), result);
  return result;
}

/** Serializes requests so the whole process stays under 1 request/second. */
function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function nominatim(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ q: address, format: "jsonv2", limit: "1", addressdetails: "0" });
  const countries = process.env.GEOCODER_COUNTRY_CODES ?? "ca";
  if (countries) params.set("countrycodes", countries);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": process.env.NOMINATIM_USER_AGENT || "Snowber/1.0 (student course project)",
      "Accept-Language": "en",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  const rows = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!rows.length) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), approximate: false, displayName: rows[0].display_name };
}

/** Deterministic pseudo-position within ~900 m of the neighborhood center. */
export function mockGeocode(address: string): GeocodeResult {
  let hash = 2166136261;
  for (const ch of address.toLowerCase()) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const a = ((hash >>> 0) % 10000) / 10000;
  const b = (((hash >>> 0) / 10000) % 10000) / 10000;
  return {
    lat: NEIGHBORHOOD_CENTER.lat + (a - 0.5) * 0.016,
    lng: NEIGHBORHOOD_CENTER.lng + (b - 0.5) * 0.022,
    approximate: false,
  };
}
