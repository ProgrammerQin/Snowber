"use client";

import { useActionState } from "react";
import { createWindowAction } from "@/app/actions/controller";
import { DateTimeField, Field, FormMessage, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MULTIPLIERS = [
  { value: "10000", label: "1× (standard)" },
  { value: "12500", label: "1.25× (busy)" },
  { value: "15000", label: "1.5× (first thing in the morning)" },
  { value: "20000", label: "2× (storm surge)" },
];

export function WindowForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action] = useActionState(createWindowAction, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Label (optional)" htmlFor="label" hint="e.g. Saturday early birds">
        <Input id="label" name="label" maxLength={60} />
      </Field>
      <DateTimeField name="startsAt" label="Starts" defaultValue={defaultStart} required />
      <DateTimeField name="endsAt" label="Ends" defaultValue={defaultEnd} required hint="Two-hour windows work well." />
      <Field label="Price multiplier" htmlFor="multiplierBps">
        <Select name="multiplierBps" defaultValue="10000">
          <SelectTrigger id="multiplierBps">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MULTIPLIERS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Open window</SubmitButton>
    </form>
  );
}
