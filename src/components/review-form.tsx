"use client";

import { useActionState, useState } from "react";
import { submitReviewAction } from "@/app/actions/reviews";
import { FormMessage, SubmitButton } from "./forms";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

export function ReviewForm({ jobId, prompt }: { jobId: string; prompt: string }) {
  const [state, action] = useActionState(submitReviewAction, null);
  const [rating, setRating] = useState(5);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{prompt}</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              className={cn("text-3xl leading-none transition-transform hover:scale-110", n <= rating ? "text-amber-500" : "text-muted-foreground/30")}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor={`comment-${jobId}`}>Comment (optional)</Label>
        <Textarea id={`comment-${jobId}`} name="comment" maxLength={1000} rows={2} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-fit">Submit review</SubmitButton>
    </form>
  );
}
