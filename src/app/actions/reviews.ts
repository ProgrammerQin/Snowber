"use server";

import { refresh } from "next/cache";
import { formToObject, runAction, type ActionResult } from "@/lib/action";
import { firstError, reviewSchema } from "@/lib/contracts/schemas";
import { createReview } from "@/lib/dal/reviews";
import { requireRole } from "@/lib/dal/session";

export async function submitReviewAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("HOMEOWNER", "CLEANER");
    const parsed = reviewSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await createReview(user, parsed.data);
    refresh();
    return { ok: true, message: "Thanks for the review!" };
  });
}
