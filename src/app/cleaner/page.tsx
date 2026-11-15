import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Navigation, Snowflake } from "lucide-react";
import { RouteMap, ROUTE_COLORS } from "@/components/map";
import { EmptyState, PageHeader, PageSkeleton, Stat } from "@/components/page";
import { StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NEIGHBORHOOD_CENTER } from "@/lib/config";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { listCleanerJobs } from "@/lib/dal/jobs";
import { getMyLedger } from "@/lib/dal/ledger";
import { requireRole } from "@/lib/dal/session";
import { listMyShifts } from "@/lib/dal/shifts";
import { getMyProfile } from "@/lib/dal/users";
import { firstName, formatMinutes, formatMoney, formatWindow } from "@/lib/format";
import { googleMapsRouteUrl } from "@/lib/geo";
import { cleanerPayout } from "@/lib/pricing";

export default function CleanerRoutePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CleanerRoute />
    </Suspense>
  );
}

async function CleanerRoute() {
  const user = await requireRole("CLEANER");
  const [jobs, profile, shifts, ledger] = await Promise.all([listCleanerJobs(user), getMyProfile(user), listMyShifts(user), getMyLedger(user)]);
  const start = profile.homeLat != null && profile.homeLng != null ? { lat: profile.homeLat, lng: profile.homeLng } : NEIGHBORHOOD_CENTER;

  const active = jobs.filter((j) => j.status === "ASSIGNED" || j.status === "IN_PROGRESS");
  const recent = jobs.filter((j) => !(j.status === "ASSIGNED" || j.status === "IN_PROGRESS"));
  const groups = new Map<string, typeof active>();
  for (const job of active) {
    const key = job.assignedWindowId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  return (
    <>
      <PageHeader title={`Hi, ${firstName(user.name)}`} description="Your stops, in the order to walk them." />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Stops ahead" value={active.length} />
        <Stat label="Upcoming shifts" value={shifts.filter((s) => s.endsAt > new Date()).length} />
        <Stat label="Balance" value={formatMoney(ledger.balanceCents)} />
      </div>

      {!profile.homeAddress && (
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Add your home address so routes start from your door.</span>
            <Button asChild size="sm" variant="secondary">
              <Link href="/cleaner/profile">Set home address</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {active.length === 0 ? (
        <EmptyState title="No stops assigned yet">
          <p>Post the hours you can work, and the controller will assign nearby driveways.</p>
          <Button asChild className="mt-4">
            <Link href="/cleaner/shifts">Post a shift</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          {[...groups.values()].map((stops, groupIndex) => {
            const window = stops[0].assignedWindow;
            const remaining = stops.filter((s) => s.status === "ASSIGNED" || s.status === "IN_PROGRESS");
            const mapsUrl = googleMapsRouteUrl(start, remaining.map((s) => s.property));
            const color = ROUTE_COLORS[groupIndex % ROUTE_COLORS.length];
            return (
              <section key={window?.id ?? groupIndex} className="grid gap-4" aria-label={window ? formatWindow(window.startsAt, window.endsAt) : "Unscheduled"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{window ? formatWindow(window.startsAt, window.endsAt) : "Unscheduled"}</h2>
                  {mapsUrl && (
                    <Button asChild variant="outline">
                      <a href={mapsUrl} target="_blank" rel="noreferrer">
                        <Navigation aria-hidden /> Open route in Google Maps
                      </a>
                    </Button>
                  )}
                </div>
                <RouteMap
                  center={start}
                  height={300}
                  starts={[{ id: "home", ...start, label: profile.homeAddress ? "Start: home" : "Start", color }]}
                  stops={stops.map((s) => ({ id: s.id, lat: s.property.lat, lng: s.property.lng, label: s.property.address.split(",")[0], color, order: s.routeOrder }))}
                  routes={[{ id: "route", color, points: [start, ...stops.map((s) => s.property)] }]}
                />
                <ol className="grid gap-3">
                  {stops.map((job) => (
                    <li key={job.id}>
                      <Link href={`/cleaner/jobs/${job.id}`} className="group block">
                        <Card className="transition-shadow group-hover:shadow-md">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                                {job.routeOrder ?? "–"}
                              </span>
                              <span className="flex-1">{job.property.address}</span>
                              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                            </CardTitle>
                            <CardDescription className="flex flex-wrap items-center gap-2 pl-11">
                              <StatusBadge status={job.status} />
                              <span>{LOT_SIZE_LABEL[job.property.lotSize]}</span>
                              <span>· about {formatMinutes(job.estMinutes)}</span>
                              <span>· you earn {formatMoney(cleanerPayout(job.priceCents) + job.tipCents)}</span>
                              {job.requiresBlower && (
                                <Badge variant="warning">
                                  <Snowflake aria-hidden /> Snow blower
                                </Badge>
                              )}
                            </CardDescription>
                          </CardHeader>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Recently finished</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {recent.map((job) => (
              <li key={job.id}>
                <Link href={`/cleaner/jobs/${job.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50">
                  <span className="font-medium">{job.property.address}</span>
                  <StatusBadge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
