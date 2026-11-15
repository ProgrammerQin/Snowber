"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/cleaner";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ phone, homeAddress, ownsBlower }: { phone: string; homeAddress: string; ownsBlower: boolean }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="grid gap-5">
      <Field label="Home address" htmlFor="homeAddress" hint="Routes start here. Only the controller sees it.">
        <Input id="homeAddress" name="homeAddress" defaultValue={homeAddress} autoComplete="street-address" />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" hint="For the controller to reach you during a storm.">
        <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>
      <div className="flex items-center gap-3">
        <Checkbox id="ownsBlower" name="ownsBlower" defaultChecked={ownsBlower} />
        <Label htmlFor="ownsBlower">I own a snow blower (lets you take large driveways without renting one)</Label>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full sm:w-fit">
        Save profile
      </SubmitButton>
    </form>
  );
}
