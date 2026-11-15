import type { Metadata } from "next";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { deleteShiftAction } from "@/app/actions/cleaner";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TIMEZONE } from "@/lib/config";
import { requireRole } from "@/lib/dal/session";
import { listMyShifts } from "@/lib/dal/shifts";
import { formatMinutes, formatWindow } from "@/lib/format";
import { wallClockIso } from "@/lib/time";
import { ShiftForm } from "./shift-form";

export const metadata: Metadata = { title: "Shifts" };

export default function ShiftsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Shifts" description="Tell the controller when you can work. You'll only be assigned jobs inside your shifts." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Shifts />
      </Suspense>
    </div>
  );
}

async function Shifts() {
  const user = await requireRole("CLEANER");
  const shifts = await listMyShifts(user);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Post a shift</CardTitle>
          <CardDescription>Up to 12 hours. Shifts can&apos;t overlap.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShiftForm defaultStart={wallClockIso(1, 6, APP_TIMEZONE)} defaultEnd={wallClockIso(1, 10, APP_TIMEZONE)} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your shifts</h2>
        {shifts.length === 0 ? (
          <EmptyState title="No shifts posted yet" />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {shifts.map((shift) => (
              <li key={shift.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{formatWindow(shift.startsAt, shift.endsAt)}</p>
                  <p className="text-sm text-muted-foreground">{formatMinutes(Math.round((shift.endsAt.getTime() - shift.startsAt.getTime()) / 60000))}</p>
                </div>
                <ActionButton
                  action={deleteShiftAction.bind(null, shift.id)}
                  variant="ghost"
                  size="sm"
                  confirm={{ title: "Remove this shift?", confirmLabel: "Remove", destructive: true }}
                >
                  <Trash2 aria-hidden /> Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
