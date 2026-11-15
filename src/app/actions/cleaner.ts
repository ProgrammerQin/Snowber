"use server";

import { refresh } from "next/cache";
import { formToObject, runAction, type ActionResult } from "@/lib/action";
import {
  cleanerProfileSchema,
  firstError,
  photoFinalizeSchema,
  photoUploadSchema,
  rentalRequestSchema,
  shiftSchema,
} from "@/lib/contracts/schemas";
import { requestPayout } from "@/lib/dal/ledger";
import { createPhotoUpload, finalizePhoto } from "@/lib/dal/photos";
import { requireRole } from "@/lib/dal/session";
import { createShift, deleteShift } from "@/lib/dal/shifts";
import { cancelMyRental, requestRental } from "@/lib/dal/tools";
import { updateCleanerProfile } from "@/lib/dal/users";
import type { UploadTarget } from "@/lib/storage";
import { formatMoney } from "@/lib/format";

export async function createShiftAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const parsed = shiftSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await createShift(user, parsed.data);
    refresh();
    return { ok: true, message: "Shift posted. The controller can now assign you jobs in that time." };
  });
}

export async function deleteShiftAction(shiftId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    await deleteShift(user, shiftId);
    refresh();
    return { ok: true, message: "Shift removed." };
  });
}

export async function requestRentalAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const parsed = rentalRequestSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await requestRental(user, parsed.data);
    refresh();
    return { ok: true, message: "Request sent to the controller." };
  });
}

export async function cancelRentalAction(rentalId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    await cancelMyRental(user, rentalId);
    refresh();
    return { ok: true, message: "Request cancelled." };
  });
}

export async function payoutAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const entry = await requestPayout(user);
    refresh();
    return { ok: true, message: `Payout of ${formatMoney(-entry.amountCents)} sent (simulated).` };
  });
}

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const parsed = cleanerProfileSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await updateCleanerProfile(user, parsed.data);
    refresh();
    return { ok: true, message: "Profile saved." };
  });
}

export async function createPhotoUploadAction(input: unknown): Promise<ActionResult<UploadTarget & { key: string }>> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const parsed = photoUploadSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    return { ok: true, data: await createPhotoUpload(user, parsed.data) };
  });
}

export async function finalizePhotoAction(input: unknown): Promise<ActionResult<{ flagged: boolean }>> {
  return runAction(async () => {
    const user = await requireRole("CLEANER");
    const parsed = photoFinalizeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const result = await finalizePhoto(user, parsed.data);
    return { ok: true, data: { flagged: result.flagged } };
  });
}
