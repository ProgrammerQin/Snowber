import { randomUUID } from "node:crypto";

// Payments sit behind a small interface. The course build uses a mock provider:
// homeowners are "charged" at booking and refunded on cancellation, and cleaners
// are paid through the ledger. A Stripe test-mode provider can implement the same
// interface later (stretch goal); real payouts to cleaners would need Stripe
// Connect identity verification and are out of scope.

export interface PaymentProvider {
  readonly name: string;
  charge(input: { jobId: string; amountCents: number; description: string }): Promise<{ externalId: string }>;
  refund(input: { externalId: string | null; amountCents: number }): Promise<void>;
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  async charge() {
    return { externalId: `mock_ch_${randomUUID()}` };
  },
  async refund() {
    // Nothing to do: no real money moves in the mock provider.
  },
};

export function getPaymentProvider(): PaymentProvider {
  return mockPaymentProvider;
}
