"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Snowflake, Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { assignAction, moveStopAction, suggestAction, unassignAction } from "@/app/actions/controller";
import { RouteMap, ROUTE_COLORS, WAITING_COLOR, type MapRoute, type MapStop } from "@/components/map";
import { StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import type { JobStatus } from "@/lib/contracts/domain";
import { formatMinutes } from "@/lib/format";
import { nearestNeighborOrder, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type JobCard = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  lotSize: string;
  estMinutes: number;
  requiresBlower: boolean;
  status: JobStatus;
  homeowner: string;
  routeOrder: number | null;
};

export type CleanerColumn = {
  id: string;
  name: string;
  start: LatLng;
  startIsHome: boolean;
  capacityMinutes: number;
  usedMinutes: number;
  hasBlower: boolean;
  rentedBlower: boolean;
  rating: number | null;
  jobs: JobCard[];
};

const REASON_TEXT: Record<string, string> = {
  "no-cleaner-with-blower": "Needs a snow blower — approve a rental for someone on shift",
  "no-capacity": "No cleaner has enough time left in this window",
  "no-cleaners": "No cleaners are on shift in this window",
};

export function DispatchBoard({
  windowId,
  windowLabel,
  center,
  waiting,
  cleaners,
}: {
  windowId: string;
  windowLabel: string;
  center: LatLng;
  waiting: JobCard[];
  cleaners: CleanerColumn[];
}) {
  const [pending, startTransition] = useTransition();
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const colorOf = useMemo(() => {
    const map = new Map(cleaners.map((c, i) => [c.id, ROUTE_COLORS[i % ROUTE_COLORS.length]]));
    return (cleanerId: string) => map.get(cleanerId) ?? WAITING_COLOR;
  }, [cleaners]);

  // Ignore suggestions for jobs that were assigned meanwhile (the board refreshes live).
  const waitingIds = new Set(waiting.map((j) => j.id));
  const activeSuggestions = Object.entries(suggested).filter(([jobId, cleanerId]) => waitingIds.has(jobId) && cleaners.some((c) => c.id === cleanerId));

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "That didn't work.");
      else {
        if (result.message) toast.success(result.message);
        onOk?.();
      }
    });

  const suggest = () =>
    startTransition(async () => {
      const result = await suggestAction(windowId);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "No suggestions." : result.error);
        return;
      }
      setSuggested(Object.fromEntries(result.data.suggestions.map((s) => [s.jobId, s.cleanerId])));
      setReasons(Object.fromEntries(result.data.unassigned.map((u) => [u.jobId, REASON_TEXT[u.reason] ?? u.reason])));
      toast(
        result.data.suggestions.length === 0
          ? "No assignments to suggest."
          : `${result.data.suggestions.length} suggestion(s) ready. Review them, then apply.`,
      );
    });

  const assign = (assignments: { jobId: string; cleanerId: string }[]) =>
    run(
      () => assignAction({ windowId, assignments }),
      () => setSuggested((current) => Object.fromEntries(Object.entries(current).filter(([jobId]) => !assignments.some((a) => a.jobId === jobId)))),
    );

  // Map: assigned stops in each cleaner's color, suggestions faded, waiting jobs grey.
  const { stops, routes, starts } = useMemo(() => {
    const stops: MapStop[] = [];
    const routes: MapRoute[] = [];
    for (const cleaner of cleaners) {
      const color = colorOf(cleaner.id);
      const ordered = [...cleaner.jobs].sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99));
      ordered.forEach((job) => stops.push({ id: job.id, lat: job.lat, lng: job.lng, label: job.address, color, order: job.routeOrder }));
      const proposed = waiting.filter((j) => suggested[j.id] === cleaner.id);
      if (ordered.length > 0) routes.push({ id: cleaner.id, color, points: [cleaner.start, ...ordered] });
      if (proposed.length > 0) {
        const from = ordered.length > 0 ? ordered[ordered.length - 1] : cleaner.start;
        routes.push({ id: `${cleaner.id}-proposed`, color, dashed: true, points: [from, ...nearestNeighborOrder(from, proposed)] });
      }
    }
    for (const job of waiting) {
      const proposedFor = suggested[job.id];
      stops.push({ id: job.id, lat: job.lat, lng: job.lng, label: job.address, color: proposedFor ? colorOf(proposedFor) : WAITING_COLOR, dashed: true });
    }
    const starts = cleaners.map((c) => ({ id: c.id, ...c.start, label: `${c.name} starts${c.startIsHome ? " (home)" : ""}`, color: colorOf(c.id) }));
    return { stops, routes, starts };
  }, [cleaners, waiting, suggested, colorOf]);

  const onDrop = (cleanerId: string, event: React.DragEvent) => {
    event.preventDefault();
    setDropTarget(null);
    const jobId = event.dataTransfer.getData("text/plain");
    if (jobId && waitingIds.has(jobId)) assign([{ jobId, cleanerId }]);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <p className="mr-auto text-sm">
          <span className="font-medium">{windowLabel}</span>
          <span className="text-muted-foreground">
            {" "}
            · {waiting.length} waiting · {cleaners.filter((c) => c.capacityMinutes > 0).length} cleaners on shift
          </span>
        </p>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />}
        <Button variant="secondary" onClick={suggest} disabled={pending || waiting.length === 0}>
          <Sparkles aria-hidden /> Suggest assignments
        </Button>
        {activeSuggestions.length > 0 && (
          <>
            <Button onClick={() => assign(activeSuggestions.map(([jobId, cleanerId]) => ({ jobId, cleanerId })))} disabled={pending}>
              Apply {activeSuggestions.length} suggestion{activeSuggestions.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={() => setSuggested({})} disabled={pending}>
              <Undo2 aria-hidden /> Clear
            </Button>
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Sticky on wide screens so jobs stay in reach while scrolling through cleaner columns. */}
        <section
          aria-labelledby="waiting-heading"
          className="grid content-start gap-3 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:self-start xl:overflow-y-auto xl:pr-1"
        >
          <h2 id="waiting-heading" className="font-semibold">
            Waiting ({waiting.length})
          </h2>
          {waiting.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Every request for this window is assigned.</p>}
          {waiting.map((job) => {
            const proposed = cleaners.find((c) => c.id === suggested[job.id]);
            return (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", job.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className={cn("cursor-grab rounded-lg border bg-card p-3 shadow-xs active:cursor-grabbing", proposed && "border-dashed")}
                style={proposed ? { borderColor: colorOf(proposed.id) } : undefined}
                data-testid="waiting-job"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link href={`/controller/jobs/${job.id}`} className="font-medium hover:underline">
                      {job.address}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {job.lotSize} · {formatMinutes(job.estMinutes)} · {job.homeowner}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {job.requiresBlower && (
                        <Badge variant="warning">
                          <Snowflake aria-hidden /> Blower
                        </Badge>
                      )}
                      {proposed && (
                        <Badge style={{ backgroundColor: colorOf(proposed.id), color: "white" }}>Suggested: {proposed.name.split(" ")[0]}</Badge>
                      )}
                    </div>
                    {reasons[job.id] && !proposed && <p className="mt-1 text-xs text-destructive">{reasons[job.id]}</p>}
                  </div>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="sr-only">Assign {job.address} to</span>
                  <select
                    className="h-8 flex-1 rounded-md border bg-background px-2 text-sm text-foreground"
                    value=""
                    disabled={pending}
                    onChange={(e) => e.target.value && assign([{ jobId: job.id, cleanerId: e.target.value }])}
                  >
                    <option value="">Assign to…</option>
                    {cleaners
                      .filter((c) => c.capacityMinutes > 0)
                      .map((c) => (
                        <option key={c.id} value={c.id} disabled={job.requiresBlower && !c.hasBlower}>
                          {c.name}
                          {job.requiresBlower && !c.hasBlower ? " (no blower)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            );
          })}
        </section>

        <div className="grid content-start gap-5">
          <RouteMap center={center} stops={stops} routes={routes} starts={starts} height={380} />

          {cleaners.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No cleaners have a shift in this window yet. Cleaners post shifts from their app.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {cleaners.map((cleaner) => {
                const color = colorOf(cleaner.id);
                const usedPct = cleaner.capacityMinutes > 0 ? (cleaner.usedMinutes / cleaner.capacityMinutes) * 100 : 100;
                const ordered = [...cleaner.jobs].sort((a, b) => (a.routeOrder ?? 99) - (b.routeOrder ?? 99));
                return (
                  <Card
                    key={cleaner.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget(cleaner.id);
                    }}
                    onDragLeave={() => setDropTarget((t) => (t === cleaner.id ? null : t))}
                    onDrop={(e) => onDrop(cleaner.id, e)}
                    className={cn("gap-3 border-t-4 py-4 transition-shadow", dropTarget === cleaner.id && "ring-4 ring-primary/30")}
                    style={{ borderTopColor: color }}
                    data-testid="cleaner-column"
                  >
                    <CardHeader className="px-4">
                      <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span>{cleaner.name}</span>
                        <span className="flex gap-1">
                          {cleaner.hasBlower && (
                            <Badge variant="info" title={cleaner.rentedBlower ? "Rented snow blower" : "Owns a snow blower"}>
                              <Snowflake aria-hidden /> {cleaner.rentedBlower ? "Rented" : "Own"} blower
                            </Badge>
                          )}
                          {cleaner.rating != null && <Badge variant="outline">★ {cleaner.rating.toFixed(1)}</Badge>}
                        </span>
                      </CardTitle>
                      <div className="grid gap-1">
                        <Progress
                          value={usedPct}
                          aria-label={`${cleaner.usedMinutes} of ${cleaner.capacityMinutes} minutes used`}
                          indicatorClassName={usedPct > 100 ? "bg-destructive" : undefined}
                        />
                        <p className="text-xs text-muted-foreground">
                          {cleaner.capacityMinutes === 0
                            ? "No shift in this window"
                            : `${formatMinutes(cleaner.usedMinutes)} of ${formatMinutes(cleaner.capacityMinutes)} used`}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-2 px-4">
                      {ordered.length === 0 && <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Drop jobs here</p>}
                      {ordered.map((job, index) => (
                        <div key={job.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ backgroundColor: color }}>
                            {job.routeOrder ?? index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/controller/jobs/${job.id}`} className="block truncate font-medium hover:underline">
                              {job.address}
                            </Link>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <StatusBadge status={job.status} /> {formatMinutes(job.estMinutes)}
                            </div>
                          </div>
                          {job.status === "ASSIGNED" && (
                            <div className="flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={pending || index === 0}
                                aria-label={`Move ${job.address} earlier`}
                                onClick={() => run(() => moveStopAction(job.id, "up"))}
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={pending || index === ordered.length - 1}
                                aria-label={`Move ${job.address} later`}
                                onClick={() => run(() => moveStopAction(job.id, "down"))}
                              >
                                <ArrowDown />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={pending}
                                aria-label={`Unassign ${job.address}`}
                                onClick={() => run(() => unassignAction(job.id))}
                              >
                                <X />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {waiting
                        .filter((j) => suggested[j.id] === cleaner.id)
                        .map((job) => (
                          <div key={job.id} className="rounded-md border border-dashed p-2 text-sm text-muted-foreground" style={{ borderColor: color }}>
                            Suggested: {job.address}
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
