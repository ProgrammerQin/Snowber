import type { Metadata } from "next";
import { Suspense } from "react";
import { cancelRentalAction } from "@/app/actions/cleaner";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TIMEZONE } from "@/lib/config";
import { RENTAL_STATUS_LABEL, TOOL_TYPE_LABEL } from "@/lib/contracts/domain";
import { requireRole } from "@/lib/dal/session";
import { listMyShifts } from "@/lib/dal/shifts";
import { listMyRentals, listToolsForCleaner } from "@/lib/dal/tools";
import { formatMoney, formatWindow } from "@/lib/format";
import { wallClockIso } from "@/lib/time";
import { RentalForm } from "./rental-form";

export const metadata: Metadata = { title: "Tools" };

export default function CleanerToolsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Tool library"
        description="Rent a snow blower to take on large driveways. Fees come out of your earnings when the controller approves."
      />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Tools />
      </Suspense>
    </div>
  );
}

async function Tools() {
  const user = await requireRole("CLEANER");
  const [tools, rentals, shifts] = await Promise.all([listToolsForCleaner(user), listMyRentals(user), listMyShifts(user)]);
  const nextShift = shifts.find((s) => s.endsAt > new Date());
  const available = tools.filter((t) => t.status === "AVAILABLE");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Request a tool</CardTitle>
          <CardDescription>{nextShift ? "Times default to your next shift." : "Pick when you need it."}</CardDescription>
        </CardHeader>
        <CardContent>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tools are available right now.</p>
          ) : (
            <RentalForm
              tools={available.map((t) => ({ id: t.id, label: `${t.name} · ${TOOL_TYPE_LABEL[t.type]} · ${formatMoney(t.feeCents)}` }))}
              defaultStart={nextShift?.startsAt.toISOString() ?? wallClockIso(1, 6, APP_TIMEZONE)}
              defaultEnd={nextShift?.endsAt.toISOString() ?? wallClockIso(1, 12, APP_TIMEZONE)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Library</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {tools.map((tool) => (
              <li key={tool.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{tool.name}</span>
                  <Badge variant={tool.status === "AVAILABLE" ? "success" : "muted"}>{tool.status === "AVAILABLE" ? formatMoney(tool.feeCents) : "Maintenance"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{TOOL_TYPE_LABEL[tool.type]}</p>
                {tool.rentals.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Booked: {tool.rentals.map((r) => formatWindow(r.startsAt, r.endsAt)).join("; ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-semibold">My rentals</h2>
        {rentals.length === 0 ? (
          <EmptyState title="No rentals yet" />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {rentals.map((rental) => (
              <li key={rental.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{rental.tool.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatWindow(rental.startsAt, rental.endsAt)} · {formatMoney(rental.feeCents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rental.status === "APPROVED" ? "success" : rental.status === "REQUESTED" ? "info" : "muted"}>
                    {RENTAL_STATUS_LABEL[rental.status]}
                  </Badge>
                  {rental.status === "REQUESTED" && (
                    <ActionButton action={cancelRentalAction.bind(null, rental.id)} variant="ghost" size="sm">
                      Cancel
                    </ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
