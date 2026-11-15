"use client";

import { useActionState, useState } from "react";
import { disputeJobAction } from "@/app/actions/homeowner";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DisputeButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(disputeJobAction, null);
  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        Report a problem
      </Button>
      <Dialog open={open && !state?.ok} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What went wrong?</DialogTitle>
            <DialogDescription>
              The controller will review the photos and contact you. Your cleaner won&apos;t be paid until it&apos;s resolved.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <input type="hidden" name="jobId" value={jobId} />
            <Label htmlFor="reason">Describe the problem</Label>
            <Textarea id="reason" name="reason" minLength={10} maxLength={1000} required rows={4} />
            <FormMessage state={state} />
            <SubmitButton variant="destructive">Send to the controller</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
