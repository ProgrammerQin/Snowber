import { describe, expect, it } from "vitest";
import { overlapMinutes, routeMinutes, suggestAssignments, type MatchCleaner, type MatchJob } from "@/lib/matching";

// A tiny grid neighborhood: 0.001° latitude ≈ 111 m.
const at = (dLat: number, dLng: number) => ({ lat: 43.66 + dLat, lng: -79.41 + dLng });
let seq = 0;
function job(id: string, pos: { lat: number; lng: number }, overrides: Partial<MatchJob> = {}): MatchJob {
  return { id, ...pos, estMinutes: 30, requiresBlower: false, createdAt: new Date(2026, 10, 7, 5, seq++), ...overrides };
}
function cleaner(id: string, start: { lat: number; lng: number }, overrides: Partial<MatchCleaner> = {}): MatchCleaner {
  return { id, start, capacityMinutes: 120, hasBlower: false, ...overrides };
}

describe("suggestAssignments", () => {
  it("gives each job to the nearest cleaner with capacity", () => {
    const result = suggestAssignments(
      [job("north", at(0.004, 0)), job("south", at(-0.004, 0))],
      [cleaner("ana", at(0.005, 0)), cleaner("ben", at(-0.005, 0))],
    );
    expect(result.suggestions.map((s) => [s.jobId, s.cleanerId])).toEqual([
      ["north", "ana"],
      ["south", "ben"],
    ]);
    expect(result.unassigned).toEqual([]);
  });

  it("sends large lots only to cleaners with a snow blower", () => {
    const result = suggestAssignments(
      [job("big", at(0.001, 0), { requiresBlower: true })],
      [cleaner("near-no-blower", at(0.001, 0)), cleaner("far-blower", at(0.01, 0), { hasBlower: true })],
    );
    expect(result.suggestions[0]).toMatchObject({ jobId: "big", cleanerId: "far-blower" });
  });

  it("reports why a job could not be placed", () => {
    const noBlower = suggestAssignments([job("big", at(0, 0), { requiresBlower: true })], [cleaner("ana", at(0, 0))]);
    expect(noBlower.unassigned).toEqual([{ jobId: "big", reason: "no-cleaner-with-blower" }]);

    const full = suggestAssignments([job("a", at(0, 0)), job("b", at(0, 0))], [cleaner("ana", at(0, 0), { capacityMinutes: 40 })]);
    expect(full.suggestions).toHaveLength(1);
    expect(full.unassigned).toEqual([{ jobId: "b", reason: "no-capacity" }]);

    expect(suggestAssignments([job("a", at(0, 0))], []).unassigned[0].reason).toBe("no-cleaners");
  });

  it("serves older requests first when capacity is short", () => {
    const older = job("older", at(0.003, 0), { createdAt: new Date(2026, 10, 7, 4, 0) });
    const newer = job("newer", at(0.001, 0), { createdAt: new Date(2026, 10, 7, 4, 30) });
    const result = suggestAssignments([newer, older], [cleaner("ana", at(0, 0), { capacityMinutes: 40 })]);
    expect(result.suggestions.map((s) => s.jobId)).toEqual(["older"]);
  });

  it("counts walking time and existing assignments against capacity", () => {
    const existing = [{ jobId: "kept", ...at(0.002, 0), estMinutes: 30 }];
    const result = suggestAssignments(
      [job("new", at(0.004, 0))],
      [cleaner("ana", at(0, 0), { capacityMinutes: 60, existing })],
    );
    // 30 min existing job + walks: not enough room for another 30 min job.
    expect(result.suggestions).toHaveLength(0);
    expect(result.routes.ana).toEqual(["kept"]);
  });

  it("orders each route by nearest neighbor from the cleaner's start", () => {
    const result = suggestAssignments(
      [job("far", at(0.006, 0)), job("near", at(0.001, 0)), job("mid", at(0.003, 0))],
      [cleaner("ana", at(0, 0), { capacityMinutes: 240 })],
    );
    expect(result.routes.ana).toEqual(["near", "mid", "far"]);
    expect(result.usedMinutes.ana).toBeGreaterThanOrEqual(90);
  });

  it("breaks distance ties with the higher rating", () => {
    const result = suggestAssignments(
      [job("j", at(0, 0))],
      [cleaner("low", at(0.001, 0), { rating: 3.5 }), cleaner("high", at(0.001, 0), { rating: 4.9 })],
    );
    expect(result.suggestions[0].cleanerId).toBe("high");
  });
});

describe("helpers", () => {
  it("measures shift/window overlap in minutes", () => {
    const d = (h: number) => new Date(Date.UTC(2026, 10, 7, h));
    expect(overlapMinutes(d(5), d(9), d(6), d(8))).toBe(120);
    expect(overlapMinutes(d(5), d(7), d(6), d(8))).toBe(60);
    expect(overlapMinutes(d(5), d(6), d(6), d(8))).toBe(0);
  });

  it("adds job time and walking time along a route", () => {
    expect(routeMinutes(at(0, 0), [])).toBe(0);
    expect(routeMinutes(at(0, 0), [{ jobId: "a", ...at(0, 0), estMinutes: 25 }])).toBe(25);
  });
});
