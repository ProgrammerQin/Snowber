import type { Metadata } from "next";
import { Suspense } from "react";
import { decideRentalAction, markReturnedAction } from "@/app/actions/controller";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TOOL_TYPE_LABEL } from "@/lib/contracts/domain";
import { requireRole } from "@/lib/dal/session";
import { listRentalsForController, listToolsForController } from "@/lib/dal/tools";
import { formatMoney, formatWindow } from "@/lib/format";
import { ToolForm, ToolStatusSelect } from "./tool-forms";

export const metadata: Metadata = { title: "Tool library" };

export default function ControllerToolsPage() {
  return (
    <>
      <PageHeader title="Tool library" description="Approve rentals (fees go to the cleaner's ledger) and keep the inventory up to date." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Tools />
      </Suspense>
    </>
  );
}

async function Tools() {
  const user = await requireRole("CONTROLLER");
  const [tools, rentals] = await Promise.all([listToolsForController(user), listRentalsForController(user)]);
  const requests = rentals.filter((r) => r.status === "REQUESTED");
  const active = rentals.filter((r) => r.status === "APPROVED");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rental requests ({requests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="grid gap-3">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">
                        {r.cleaner.name} · {r.tool.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatWindow(r.startsAt, r.endsAt)} · {formatMoney(r.feeCents)} fee
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton action={decideRentalAction.bind(null, r.id, true)} size="sm" variant="success">
                        Approve
                      </ActionButton>
                      <ActionButton action={decideRentalAction.bind(null, r.id, false)} size="sm" variant="outline">
                        Decline
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Out on rental</CardTitle>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is rented out.</p>
            ) : (
              <ul className="grid gap-2">
                {active.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span>
                      <span className="font-medium">{r.tool.name}</span> → {r.cleaner.name} · {formatWindow(r.startsAt, r.endsAt)}
                    </span>
                    <ActionButton action={markReturnedAction.bind(null, r.id)} size="sm" variant="ghost">
                      Mark returned
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <EmptyState title="No tools yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell className="font-medium">
                        {tool.name}
                        {tool.notes && <p className="text-xs font-normal text-muted-foreground">{tool.notes}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{TOOL_TYPE_LABEL[tool.type]}</Badge>
                      </TableCell>
                      <TableCell>{formatMoney(tool.feeCents)}</TableCell>
                      <TableCell className="w-44">
                        <ToolStatusSelect toolId={tool.id} status={tool.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add a tool</CardTitle>
          <CardDescription>Flat fee per rental.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToolForm />
        </CardContent>
      </Card>
    </div>
  );
}
