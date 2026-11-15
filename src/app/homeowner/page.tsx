import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CalendarClock, Home, Plus } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { autoConfirmStale, listHomeownerJobs } from "@/lib/dal/jobs";
import { listMyProperties } from "@/lib/dal/properties";
import { requireRole } from "@/lib/dal/session";
import { firstName, formatMoney, formatWindow } from "@/lib/format";

export default function HomeownerHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeownerHome />
    </Suspense>
  );
}

async function HomeownerHome() {
  const user = await requireRole("HOMEOWNER");
  await autoConfirmStale();
  const [jobs, properties] = await Promise.all([listHomeownerJobs(user), listMyProperties(user)]);
  const active = jobs.filter((j) => !["CONFIRMED", "CANCELLED"].includes(j.status));
  const past = jobs.filter((j) => ["CONFIRMED", "CANCELLED"].includes(j.status));

  return (
    <>
      <PageHeader
        title={`Hi, ${firstName(user.name)}`}
        description="Book clearing for the next snowfall and follow each job live."
        actions={
          properties.length > 0 && (
            <Button asChild size="lg">
              <Link href="/homeowner/book">
                <CalendarClock aria-hidden /> Book clearing
              </Link>
            </Button>
          )
        }
      />

      {properties.length === 0 ? (
        <EmptyState title="Start by adding your property">
          <p>We need the address and driveway size to price and route the job.</p>
          <Button asChild className="mt-4">
            <Link href="/homeowner/properties/new">
              <Plus aria-hidden /> Add property
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          <section aria-labelledby="active-jobs">
            <h2 id="active-jobs" className="mb-3 text-lg font-semibold">
              Current jobs
            </h2>
            {active.length === 0 ? (
              <EmptyState title="No upcoming clearing booked">Snow on the way? Book a time window before it fills up.</EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {active.map((job) => (
                  <Link key={job.id} href={`/homeowner/jobs/${job.id}`} className="group">
                    <Card className="h-full transition-shadow group-hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-start justify-between gap-2">
                          <span>{job.property.label ?? job.property.address}</span>
                          <StatusBadge status={job.status} />
                        </CardTitle>
                        <CardDescription>
                          {job.assignedWindow
                            ? formatWindow(job.assignedWindow.startsAt, job.assignedWindow.endsAt)
                            : `Any of ${job.windowOptions.length} window${job.windowOptions.length === 1 ? "" : "s"} from ${
                                job.windowOptions[0] ? formatWindow(job.windowOptions[0].startsAt, job.windowOptions[0].endsAt) : "—"
                              }`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{job.cleaner ? `Cleaner: ${firstName(job.cleaner.name)}` : "Waiting for a cleaner"}</span>
                        <span className="font-medium">{formatMoney(job.priceCents + job.tipCents)}</span>
                      </CardContent>
                      {job.status === "COMPLETED" && (
                        <CardContent>
                          <Badge variant="warning">
                            <AlertTriangle aria-hidden /> Check the photos and confirm
                          </Badge>
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="properties">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="properties" className="text-lg font-semibold">
                Properties
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/homeowner/properties/new">
                  <Plus aria-hidden /> Add property
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {properties.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="size-4 text-primary" aria-hidden />
                      {p.label ?? p.address}
                    </CardTitle>
                    <CardDescription>
                      {p.label && <>{p.address} · </>}
                      {LOT_SIZE_LABEL[p.lotSize]}
                      {p.hasSidewalk ? " · sidewalk" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    {p.approximate ? (
                      <span className="text-xs text-amber-700">Map position is approximate</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">On the map</span>
                    )}
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/homeowner/book?property=${p.id}`}>Book this property</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-jobs">
              <h2 id="past-jobs" className="mb-3 text-lg font-semibold">
                Past jobs
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {past.map((job) => (
                  <li key={job.id}>
                    <Link href={`/homeowner/jobs/${job.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50">
                      <span className="font-medium">{job.property.label ?? job.property.address}</span>
                      <span className="text-sm text-muted-foreground">
                        {job.assignedWindow ? formatWindow(job.assignedWindow.startsAt, job.assignedWindow.endsAt) : "Not scheduled"}
                      </span>
                      <StatusBadge status={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
