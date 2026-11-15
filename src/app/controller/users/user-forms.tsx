"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { createControllerAction, setRoleAction } from "@/app/actions/controller";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/contracts/domain";

export function ControllerAccountForm() {
  const [state, action] = useActionState(createControllerAction, null);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Name" htmlFor="ctrl-name">
        <Input id="ctrl-name" name="name" required minLength={2} />
      </Field>
      <Field label="Email" htmlFor="ctrl-email">
        <Input id="ctrl-email" name="email" type="email" required />
      </Field>
      <Field label="Temporary password" htmlFor="ctrl-password" hint="At least 8 characters.">
        <Input id="ctrl-password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setRoleAction(userId, value);
          if (!result.ok) toast.error(result.error);
          else toast.success(result.message ?? "Role updated.");
        })
      }
    >
      <SelectTrigger size="sm" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
