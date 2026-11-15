"use client";

import { useActionState } from "react";
import { requestRentalAction } from "@/app/actions/cleaner";
import { DateTimeField, Field, FormMessage, SubmitButton } from "@/components/forms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RentalForm({
  tools,
  defaultStart,
  defaultEnd,
}: {
  tools: { id: string; label: string }[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, action] = useActionState(requestRentalAction, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Tool" htmlFor="toolId">
        <Select name="toolId" defaultValue={tools[0]?.id} required>
          <SelectTrigger id="toolId">
            <SelectValue placeholder="Choose a tool" />
          </SelectTrigger>
          <SelectContent>
            {tools.map((tool) => (
              <SelectItem key={tool.id} value={tool.id}>
                {tool.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField name="startsAt" label="Pick up" defaultValue={defaultStart} required />
        <DateTimeField name="endsAt" label="Return" defaultValue={defaultEnd} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-fit">Request tool</SubmitButton>
    </form>
  );
}
