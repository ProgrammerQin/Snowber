// Rate card and quoting. Pure functions: the server recomputes every price,
// so a client can never set its own price.

import type { LotSize } from "./contracts/domain";

export const RATE_CARD = {
  baseCents: { SMALL: 3000, MEDIUM: 4500, LARGE: 6500 } satisfies Record<LotSize, number>,
  sidewalkCents: 1000,
  saltCents: 800,
  minutes: { SMALL: 25, MEDIUM: 40, LARGE: 55 } satisfies Record<LotSize, number>,
  sidewalkMinutes: 10,
  saltMinutes: 5,
  /** Cleaners keep 80% of the price; the rest funds tools and operations. */
  cleanerShareBps: 8000,
} as const;

export type QuoteInput = {
  lotSize: LotSize;
  includeSidewalk: boolean;
  includeSalt: boolean;
  /** Window multiplier in basis points (10000 = 1.00x). */
  multiplierBps: number;
};

export type Quote = {
  baseCents: number;
  addOnsCents: number;
  subtotalCents: number;
  multiplierBps: number;
  totalCents: number;
  estMinutes: number;
  requiresBlower: boolean;
  cleanerPayoutCents: number;
};

export function applyMultiplier(cents: number, multiplierBps: number): number {
  return Math.round((cents * multiplierBps) / 10000);
}

export function quote(input: QuoteInput): Quote {
  if (!Number.isInteger(input.multiplierBps) || input.multiplierBps < 5000 || input.multiplierBps > 30000) {
    throw new RangeError("multiplierBps must be an integer between 5000 and 30000");
  }
  const baseCents = RATE_CARD.baseCents[input.lotSize];
  const addOnsCents =
    (input.includeSidewalk ? RATE_CARD.sidewalkCents : 0) + (input.includeSalt ? RATE_CARD.saltCents : 0);
  const subtotalCents = baseCents + addOnsCents;
  const totalCents = applyMultiplier(subtotalCents, input.multiplierBps);
  const estMinutes =
    RATE_CARD.minutes[input.lotSize] +
    (input.includeSidewalk ? RATE_CARD.sidewalkMinutes : 0) +
    (input.includeSalt ? RATE_CARD.saltMinutes : 0);

  return {
    baseCents,
    addOnsCents,
    subtotalCents,
    multiplierBps: input.multiplierBps,
    totalCents,
    estMinutes,
    requiresBlower: input.lotSize === "LARGE",
    cleanerPayoutCents: cleanerPayout(totalCents),
  };
}

/**
 * A homeowner may accept several windows with different multipliers.
 * They are charged for the most expensive one up front; if the controller assigns
 * a cheaper window, the difference is refunded at assignment time.
 */
export function quoteForWindows(base: Omit<QuoteInput, "multiplierBps">, multipliersBps: number[]): Quote {
  if (multipliersBps.length === 0) throw new RangeError("Pick at least one window");
  return quote({ ...base, multiplierBps: Math.max(...multipliersBps) });
}

export function cleanerPayout(totalCents: number): number {
  return Math.floor((totalCents * RATE_CARD.cleanerShareBps) / 10000);
}
