import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton, Stat } from "@/components/page";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/misc";
import { getControllerOverview } from "@/lib/dal/overview";
import { requireRole } from "@/lib/dal/session";
import { firstName, formatMultiplier, formatWindow } from "@/lib/format";

export default function ControllerOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireRole("CONTROLLER");
  const o = await getControllerOverview(user);
  const attention = o.counts.DISPUTED + o.pendingRentals + o.flaggedPhotos;

  return (
    <>
      <PageHeader
        title="Operations overview"
        description="Open windows before the storm, dispatch cleaners, and handle anything that needs a person."
        actions={
          <Button asChild size="lg">
            <Link href="/controller/dispatch">
              Open dispatch board <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      {attention > 0 && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle aria-hidden />
          <AlertTitle>Needs attention</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {o.counts.DISPUTED > 0 && (
                <li>
                  <Link className="underline" href="/controller/jobs?status=DISPUTED">
                    {o.counts.DISPUTED} disputed job(s)
                  </Link>
                </li>
              )}
              {o.pendingRentals > 0 && (
                <li>
                  <Link className="underline" href="/controller/tools">
                    {o.pendingRentals} tool rental request(s)
                  </Link>
                </li>
              )}
              {o.flaggedPhotos > 0 && (
                <li>
                  <Link className="underline" href="/controller/jobs?status=COMPLETED">
                    {o.flaggedPhotos} flagged photo(s) on recent jobs
                  </Link>
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Waiting" value={o.counts.REQUESTED} hint="requested, not assigned" />
        <Stat label="Assigned" value={o.counts.ASSIGNED} />
        <Stat label="In progress" value={o.counts.IN_PROGRESS} />
        <Stat label="Awaiting confirmation" value={o.counts.COMPLETED} />
        <Stat label="Cleaners on shift" value={o.cleanersOnShift} hint="next 24 hours" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Upcoming windows
              <Button asChild variant="link" size="sm">
                <Link href="/controller/windows">Manage</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {o.upcomingWindows.length === 0 ? (
              <EmptyState title="No windows open">
                <Link className="text-primary underline" href="/controller/windows">
                  Open a window
                </Link>{" "}
                when snow is forecast.
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {o.upcomingWindows.map((w) => (
                  <li key={w.id}>
                    <Link href={`/controller/dispatch?window=${w.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{w.label ?? formatWindow(w.startsAt, w.endsAt)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatWindow(w.startsAt, w.endsAt)} · {formatMultiplier(w.multiplierBps)} · {w.status === "OPEN" ? "open" : "closed"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{w._count.optionJobs} requested</p>
                        <p className="text-muted-foreground">{w._count.assignedJobs} assigned</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {o.recentJobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/controller/jobs/${job.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted/50">
                    <span className="text-sm">
                      <span className="font-medium">{job.property.address}</span>
                      {job.cleaner && <span className="text-muted-foreground"> · {firstName(job.cleaner.name)}</span>}
                    </span>
                    <StatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
