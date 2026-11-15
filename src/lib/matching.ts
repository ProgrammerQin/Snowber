// Matching service: a pure, unit-tested greedy heuristic.
//
// For one service window, jobs are taken oldest first. Each job goes to the nearest
// cleaner (measured from where that cleaner's route currently ends) who
//   1. has a shift covering the window,
//   2. has enough remaining minutes for the job plus the walk to it, and
//   3. has the required equipment (large lots need a snow blower, owned or rented).
// Each cleaner's stops are then re-ordered by nearest neighbor.
//
// Optimal routing is a vehicle-routing problem and out of scope; the controller
// reviews every suggestion and can override it.

import { haversineKm, nearestNeighborOrder, walkingMinutes, type LatLng } from "./geo";

export type MatchJob = LatLng & {
  id: string;
  estMinutes: number;
  requiresBlower: boolean;
  createdAt: Date;
};

export type AssignedStop = LatLng & { jobId: string; estMinutes: number };

export type MatchCleaner = {
  id: string;
  start: LatLng;
  /** Minutes of shift time that overlap the window. */
  capacityMinutes: number;
  hasBlower: boolean;
  /** Average rating, used only to break distance ties. */
  rating?: number | null;
  /** Jobs already assigned to this cleaner in the window (kept, never moved). */
  existing?: AssignedStop[];
};

export type Suggestion = {
  jobId: string;
  cleanerId: string;
  distanceKm: number;
  travelMinutes: number;
};

export type UnassignedReason = "no-cleaner-with-blower" | "no-capacity" | "no-cleaners";

export type MatchResult = {
  suggestions: Suggestion[];
  unassigned: { jobId: string; reason: UnassignedReason }[];
  /** Final stop order per cleaner, existing and suggested jobs together. */
  routes: Record<string, string[]>;
  /** Minutes each cleaner would be busy (jobs + walking). */
  usedMinutes: Record<string, number>;
};

type CleanerState = {
  cleaner: MatchCleaner;
  position: LatLng;
  remaining: number;
  stops: AssignedStop[];
};

/** Minutes needed to walk the given stops in order from `start` and do every job. */
export function routeMinutes(start: LatLng, stops: readonly AssignedStop[]): number {
  let minutes = 0;
  let current = start;
  for (const stop of stops) {
    minutes += walkingMinutes(haversineKm(current, stop)) + stop.estMinutes;
    current = stop;
  }
  return minutes;
}

export function suggestAssignments(jobs: readonly MatchJob[], cleaners: readonly MatchCleaner[]): MatchResult {
  const states: CleanerState[] = cleaners.map((cleaner) => {
    const existing = nearestNeighborOrder(cleaner.start, cleaner.existing ?? []);
    const used = routeMinutes(cleaner.start, existing);
    return {
      cleaner,
      position: existing.length > 0 ? existing[existing.length - 1] : cleaner.start,
      remaining: cleaner.capacityMinutes - used,
      stops: existing,
    };
  });

  const suggestions: Suggestion[] = [];
  const unassigned: MatchResult["unassigned"] = [];

  const ordered = [...jobs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

  for (const job of ordered) {
    if (states.length === 0) {
      unassigned.push({ jobId: job.id, reason: "no-cleaners" });
      continue;
    }
    const equipped = states.filter((s) => !job.requiresBlower || s.cleaner.hasBlower);
    if (equipped.length === 0) {
      unassigned.push({ jobId: job.id, reason: "no-cleaner-with-blower" });
      continue;
    }

    let best: { state: CleanerState; km: number; travel: number } | null = null;
    for (const state of equipped) {
      const km = haversineKm(state.position, job);
      const travel = walkingMinutes(km);
      if (travel + job.estMinutes > state.remaining) continue;
      const better =
        best === null ||
        km < best.km - 1e-9 ||
        (Math.abs(km - best.km) <= 1e-9 && (state.cleaner.rating ?? 0) > (best.state.cleaner.rating ?? 0));
      if (better) best = { state, km, travel };
    }

    if (!best) {
      unassigned.push({ jobId: job.id, reason: "no-capacity" });
      continue;
    }

    best.state.remaining -= best.travel + job.estMinutes;
    best.state.position = job;
    best.state.stops.push({ jobId: job.id, lat: job.lat, lng: job.lng, estMinutes: job.estMinutes });
    suggestions.push({
      jobId: job.id,
      cleanerId: best.state.cleaner.id,
      distanceKm: Math.round(best.km * 1000) / 1000,
      travelMinutes: best.travel,
    });
  }

  const routes: Record<string, string[]> = {};
  const usedMinutes: Record<string, number> = {};
  for (const state of states) {
    const route = nearestNeighborOrder(state.cleaner.start, state.stops);
    routes[state.cleaner.id] = route.map((s) => s.jobId);
    usedMinutes[state.cleaner.id] = routeMinutes(state.cleaner.start, route);
  }

  return { suggestions, unassigned, routes, usedMinutes };
}

/** Overlap in minutes between [aStart, aEnd) and [bStart, bEnd). */
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, Math.floor((end - start) / 60000));
}
