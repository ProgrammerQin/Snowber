"use client";

import { useActionState } from "react";
import { createPropertyAction } from "@/app/actions/homeowner";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LOT_SIZES, LOT_SIZE_LABEL } from "@/lib/contracts/domain";

export function PropertyForm() {
  const [state, action] = useActionState(createPropertyAction, null);
  return (
    <Card>
      <CardContent>
        <form action={action} className="grid gap-5">
          <Field label="Street address" htmlFor="address" hint="Include the city, e.g. 41 Maple Crescent, Toronto, ON">
            <Input id="address" name="address" autoComplete="street-address" required minLength={5} />
          </Field>
          <Field label="Nickname (optional)" htmlFor="label" hint="e.g. Home, Mom's place">
            <Input id="label" name="label" maxLength={60} />
          </Field>
          <Field label="Driveway size" htmlFor="lotSize" hint="Large lots need a cleaner with a snow blower.">
            <Select name="lotSize" defaultValue="MEDIUM" required>
              <SelectTrigger id="lotSize">
                <SelectValue placeholder="Choose a size" />
              </SelectTrigger>
              <SelectContent>
                {LOT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {LOT_SIZE_LABEL[size]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-3">
            <Checkbox id="hasSidewalk" name="hasSidewalk" defaultChecked />
            <Label htmlFor="hasSidewalk">There&apos;s a public sidewalk in front to clear</Label>
          </div>
          <Field label="Notes for the cleaner (optional)" htmlFor="notes" hint="Gate code, where to pile snow, steps to watch out for…">
            <Textarea id="notes" name="notes" maxLength={500} rows={3} />
          </Field>
          <FormMessage state={state} />
          <SubmitButton size="lg">Save property</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
