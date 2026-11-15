"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";
import { toLocalInputValue } from "@/lib/format";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, Skeleton } from "./ui/misc";

export function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? <p className="text-sm text-success" role="status">{state.message}</p> : null;
  }
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const subscribeNoop = () => () => {};
/** True only in the browser after hydration (avoids time-zone hydration mismatches). */
export function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * <input type="datetime-local"> shows the browser's local time; a hidden field submits
 * the exact instant as ISO 8601 so the server never has to guess the time zone.
 */
export function DateTimeField(props: { name: string; label: string; defaultValue?: string; required?: boolean; hint?: string }) {
  const isClient = useIsClient();
  if (!isClient) {
    return (
      <div className="grid gap-2">
        <Label>{props.label}</Label>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  return <DateTimeFieldInner {...props} />;
}

function DateTimeFieldInner({ name, label, defaultValue, required, hint }: { name: string; label: string; defaultValue?: string; required?: boolean; hint?: string }) {
  const [local, setLocal] = useState(() => (defaultValue ? toLocalInputValue(new Date(defaultValue)) : ""));
  const id = `${name}-input`;
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="datetime-local" value={local} required={required} onChange={(e) => setLocal(e.target.value)} />
      <input type="hidden" name={name} value={iso} />
    </Field>
  );
}

type Confirm = { title: string; description?: string; confirmLabel?: string; destructive?: boolean };

/**
 * Calls a (bound) server action and reports the result as a toast. With `confirm`,
 * an accessible dialog asks first.
 */
export function ActionButton({
  action,
  children,
  confirm,
  successMessage,
  ...buttonProps
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: Confirm;
  successMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (!result.ok) toast.error(result.error);
      else if (result.message ?? successMessage) toast.success(result.message ?? successMessage);
    });

  return (
    <>
      <Button {...buttonProps} disabled={pending || buttonProps.disabled} onClick={() => (confirm ? setOpen(true) : run())}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </Button>
      {confirm && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              {confirm.description && <DialogDescription>{confirm.description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Keep it
              </Button>
              <Button variant={confirm.destructive ? "destructive" : "default"} onClick={run} disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
