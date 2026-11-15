"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { createToolAction, setToolStatusAction } from "@/app/actions/controller";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TOOL_STATUSES, TOOL_TYPES, TOOL_TYPE_LABEL, type ToolStatus } from "@/lib/contracts/domain";

export function ToolForm() {
  const [state, action] = useActionState(createToolAction, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Name" htmlFor="tool-name">
        <Input id="tool-name" name="name" required minLength={2} maxLength={80} placeholder="Blower #3" />
      </Field>
      <Field label="Type" htmlFor="tool-type">
        <Select name="type" defaultValue="SNOW_BLOWER">
          <SelectTrigger id="tool-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TOOL_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Rental fee ($)" htmlFor="tool-fee">
        <Input id="tool-fee" name="feeDollars" type="number" min={0} max={500} step="0.5" defaultValue={15} required />
      </Field>
      <Field label="Notes (optional)" htmlFor="tool-notes">
        <Input id="tool-notes" name="notes" maxLength={300} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Add tool</SubmitButton>
    </form>
  );
}

const STATUS_LABEL: Record<ToolStatus, string> = { AVAILABLE: "Available", MAINTENANCE: "Maintenance", RETIRED: "Retired" };

export function ToolStatusSelect({ toolId, status }: { toolId: string; status: ToolStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setToolStatusAction(toolId, value);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <SelectTrigger size="sm" aria-label="Tool status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TOOL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
