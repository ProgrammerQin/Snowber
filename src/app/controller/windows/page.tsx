import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { setWindowStatusAction } from "@/app/actions/controller";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APP_TIMEZONE } from "@/lib/config";
import { requireRole } from "@/lib/dal/session";
import { listWindowsForController } from "@/lib/dal/windows";
import { formatMultiplier, formatWindow } from "@/lib/format";
import { wallClockIso } from "@/lib/time";
import { WindowForm } from "./window-form";

export const metadata: Metadata = { title: "Service windows" };

export default function WindowsPage() {
  return (
    <>
      <PageHeader title="Service windows" description="Open time windows when snow is forecast. Early windows can cost more." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Windows />
      </Suspense>
    </>
  );
}

async function Windows() {
  const user = await requireRole("CONTROLLER");
  const windows = await listWindowsForController(user);
  const now = new Date();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Open a window</CardTitle>
          <CardDescription>Homeowners can book it right away.</CardDescription>
        </CardHeader>
        <CardContent>
          <WindowForm defaultStart={wallClockIso(1, 6, APP_TIMEZONE)} defaultEnd={wallClockIso(1, 8, APP_TIMEZONE)} />
        </CardContent>
      </Card>

      {windows.length === 0 ? (
        <EmptyState title="No windows yet" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Window</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {windows.map((w) => {
                  const past = w.endsAt < now;
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="font-medium">{w.label ?? formatWindow(w.startsAt, w.endsAt)}</p>
                        {w.label && <p className="text-xs text-muted-foreground">{formatWindow(w.startsAt, w.endsAt)}</p>}
                      </TableCell>
                      <TableCell>{formatMultiplier(w.multiplierBps)}</TableCell>
                      <TableCell>{w._count.optionJobs}</TableCell>
                      <TableCell>{w._count.assignedJobs}</TableCell>
                      <TableCell>
                        <Badge variant={past ? "muted" : w.status === "OPEN" ? "success" : "secondary"}>{past ? "Past" : w.status === "OPEN" ? "Open" : "Closed"}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button asChild variant="link" size="sm">
                          <Link href={`/controller/dispatch?window=${w.id}`}>Dispatch</Link>
                        </Button>
                        {!past && (
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={setWindowStatusAction.bind(null, w.id, w.status === "OPEN" ? "CLOSED" : "OPEN")}
                          >
                            {w.status === "OPEN" ? "Close" : "Reopen"}
                          </ActionButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
