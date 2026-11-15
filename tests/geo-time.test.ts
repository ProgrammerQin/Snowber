import { describe, expect, it } from "vitest";
import { googleMapsRouteUrl, haversineKm, nearestNeighborOrder, walkingMinutes } from "@/lib/geo";
import { zonedCalendarDate, zonedTimeToUtc } from "@/lib/time";

describe("geo", () => {
  it("computes great-circle distance", () => {
    // Toronto City Hall to Union Station is roughly 0.9 km.
    const km = haversineKm({ lat: 43.6534, lng: -79.3839 }, { lat: 43.6453, lng: -79.3806 });
    expect(km).toBeGreaterThan(0.8);
    expect(km).toBeLessThan(1.0);
  });

  it("estimates walking time at 4.5 km/h", () => {
    expect(walkingMinutes(0)).toBe(0);
    expect(walkingMinutes(0.75)).toBe(10);
  });

  it("orders stops by nearest neighbor", () => {
    const stops = [
      { id: "c", lat: 3, lng: 0 },
      { id: "a", lat: 1, lng: 0 },
      { id: "b", lat: 2, lng: 0 },
    ];
    expect(nearestNeighborOrder({ lat: 0, lng: 0 }, stops).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("builds a Google Maps walking route through every stop", () => {
    const url = googleMapsRouteUrl({ lat: 1, lng: 2 }, [
      { lat: 3, lng: 4 },
      { lat: 5, lng: 6 },
    ])!;
    const params = new URL(url).searchParams;
    expect(params.get("travelmode")).toBe("walking");
    expect(params.get("destination")).toBe("5.000000,6.000000");
    expect(params.get("waypoints")).toBe("3.000000,4.000000");
    expect(googleMapsRouteUrl({ lat: 0, lng: 0 }, [])).toBeNull();
  });
});

describe("time zones", () => {
  it("converts Toronto wall-clock time to UTC in winter and summer", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 6 }, "America/Toronto").toISOString()).toBe("2026-12-01T11:00:00.000Z");
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 6 }, "America/Toronto").toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("reads the calendar date in a time zone", () => {
    expect(zonedCalendarDate(new Date("2026-11-07T03:00:00Z"), "America/Toronto")).toEqual({ year: 2026, month: 11, day: 6 });
  });
});
