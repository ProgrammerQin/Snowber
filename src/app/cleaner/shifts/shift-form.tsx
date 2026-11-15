"use client";

import { useActionState } from "react";
import { createShiftAction } from "@/app/actions/cleaner";
import { DateTimeField, FormMessage, SubmitButton } from "@/components/forms";

export function ShiftForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action] = useActionState(createShiftAction, null);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField name="startsAt" label="Starts" defaultValue={defaultStart} required />
        <DateTimeField name="endsAt" label="Ends" defaultValue={defaultEnd} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full sm:w-fit">
        Post shift
      </SubmitButton>
    </form>
  );
}
