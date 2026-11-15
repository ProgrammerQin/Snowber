import { describe, expect, it } from "vitest";
import { RATE_CARD, applyMultiplier, cleanerPayout, quote, quoteForWindows } from "@/lib/pricing";

describe("quote", () => {
  it("prices a small driveway with sidewalk at 1x", () => {
    const q = quote({ lotSize: "SMALL", includeSidewalk: true, includeSalt: false, multiplierBps: 10000 });
    expect(q.baseCents).toBe(RATE_CARD.baseCents.SMALL);
    expect(q.addOnsCents).toBe(RATE_CARD.sidewalkCents);
    expect(q.totalCents).toBe(4000);
    expect(q.estMinutes).toBe(35);
    expect(q.requiresBlower).toBe(false);
  });

  it("applies the window multiplier to base plus add-ons", () => {
    const q = quote({ lotSize: "MEDIUM", includeSidewalk: true, includeSalt: true, multiplierBps: 12500 });
    // (4500 + 1000 + 800) * 1.25 = 7875
    expect(q.totalCents).toBe(7875);
    expect(q.estMinutes).toBe(40 + 10 + 5);
  });

  it("marks large lots as needing a snow blower", () => {
    expect(quote({ lotSize: "LARGE", includeSidewalk: false, includeSalt: false, multiplierBps: 10000 }).requiresBlower).toBe(true);
  });

  it("rejects multipliers outside 0.5x–3x", () => {
    expect(() => quote({ lotSize: "SMALL", includeSidewalk: false, includeSalt: false, multiplierBps: 40000 })).toThrow(RangeError);
    expect(() => quote({ lotSize: "SMALL", includeSidewalk: false, includeSalt: false, multiplierBps: 1.5 })).toThrow(RangeError);
  });
});

describe("quoteForWindows", () => {
  it("charges the most expensive accepted window", () => {
    const q = quoteForWindows({ lotSize: "SMALL", includeSidewalk: false, includeSalt: false }, [10000, 15000, 12500]);
    expect(q.multiplierBps).toBe(15000);
    expect(q.totalCents).toBe(4500);
  });

  it("requires at least one window", () => {
    expect(() => quoteForWindows({ lotSize: "SMALL", includeSidewalk: false, includeSalt: false }, [])).toThrow();
  });
});

describe("payout and rounding", () => {
  it("gives cleaners 80% rounded down to the cent", () => {
    expect(cleanerPayout(4000)).toBe(3200);
    expect(cleanerPayout(7875)).toBe(6300);
    expect(cleanerPayout(999)).toBe(799);
  });

  it("rounds multiplied prices to the nearest cent", () => {
    expect(applyMultiplier(3333, 12500)).toBe(4166);
  });
});
