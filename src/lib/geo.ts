// Distance helpers. At neighborhood scale, great-circle distance in TypeScript is
// accurate enough, so the database does not need PostGIS.

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Walking pace used to estimate travel between stops (cleaners walk with their tools). */
export const WALKING_KMH = 4.5;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkingMinutes(km: number): number {
  return Math.ceil((km / WALKING_KMH) * 60);
}

/** Orders stops greedily: always walk to the closest unvisited stop next. */
export function nearestNeighborOrder<T extends LatLng>(start: LatLng, stops: readonly T[]): T[] {
  const remaining = [...stops];
  const ordered: T[] = [];
  let current = start;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

/** Total walking distance of a route that starts at `start` and visits stops in order. */
export function routeDistanceKm(start: LatLng, stops: readonly LatLng[]): number {
  let total = 0;
  let current = start;
  for (const stop of stops) {
    total += haversineKm(current, stop);
    current = stop;
  }
  return total;
}

/** Google Maps hand-off for turn-by-turn walking directions through every stop. */
export function googleMapsRouteUrl(origin: LatLng, stops: readonly LatLng[]): string | null {
  if (stops.length === 0) return null;
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).map(fmt).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: fmt(origin),
    destination: fmt(destination),
    travelmode: "walking",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
