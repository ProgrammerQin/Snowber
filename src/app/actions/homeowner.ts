"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { formToObject, runAction, type ActionResult } from "@/lib/action";
import { bookingSchema, disputeSchema, firstError, propertySchema } from "@/lib/contracts/schemas";
import { cancelJob, confirmJob, createBooking, disputeJob, previewQuote } from "@/lib/dal/jobs";
import { createProperty } from "@/lib/dal/properties";
import { requireRole } from "@/lib/dal/session";
import type { Quote } from "@/lib/pricing";

// Server actions are public POST endpoints: each one re-checks the session and
// validates its input with the shared Zod schemas before calling the DAL.

export async function createPropertyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER");
    const parsed = propertySchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const property = await createProperty(user, parsed.data);
    redirect(`/homeowner/book?property=${property.id}`);
  });
}

export async function quoteAction(input: {
  propertyId: string;
  windowIds: string[];
  includeSidewalk: boolean;
  includeSalt: boolean;
}): Promise<ActionResult<Quote>> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER");
    const parsed = bookingSchema.pick({ propertyId: true, windowIds: true, includeSidewalk: true, includeSalt: true }).safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    return { ok: true, data: await previewQuote(user, parsed.data) };
  });
}

export async function bookJobAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER");
    const parsed = bookingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const job = await createBooking(user, parsed.data);
    redirect(`/homeowner/jobs/${job.id}?booked=1`);
  });
}

export async function cancelJobAction(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER", "CONTROLLER");
    await cancelJob(user, jobId);
    refresh();
    return { ok: true, message: "Job cancelled. Your payment was refunded." };
  });
}

export async function confirmJobAction(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER");
    await confirmJob(user, jobId);
    refresh();
    return { ok: true, message: "Thanks! Your cleaner has been paid." };
  });
}

export async function disputeJobAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER");
    const parsed = disputeSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await disputeJob(user, parsed.data.jobId, parsed.data.reason);
    refresh();
    return { ok: true, message: "We've sent this to the controller, who will follow up." };
  });
}
