import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { NEIGHBORHOOD_CENTER } from "@/lib/config";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { getDispatchBoard, listDispatchWindows, type BoardJob } from "@/lib/dal/dispatch";
import { requireRole } from "@/lib/dal/session";
import { firstName, formatMultiplier, formatWindow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DispatchBoard, type JobCard } from "./dispatch-board";

export const metadata: Metadata = { title: "Dispatch" };

export default function DispatchPage({ searchParams }: PageProps<"/controller/dispatch">) {
  return (
    <>
      <PageHeader
        title="Dispatch board"
        description="Suggest assignments, adjust by dragging jobs onto cleaners, and check the routes on the map."
      />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <Dispatch searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function toCard(job: BoardJob): JobCard {
  return {
    id: job.id,
    address: job.address,
    lat: job.lat,
    lng: job.lng,
    lotSize: LOT_SIZE_LABEL[job.lotSize].split(" (")[0],
    estMinutes: job.estMinutes,
    requiresBlower: job.requiresBlower,
    status: job.status,
    homeowner: firstName(job.homeownerName),
    routeOrder: job.routeOrder,
  };
}

async function Dispatch({ searchParams }: { searchParams: PageProps<"/controller/dispatch">["searchParams"] }) {
  const user = await requireRole("CONTROLLER");
  const [{ window: requested }, windows] = await Promise.all([searchParams, listDispatchWindows(user)]);
  if (windows.length === 0) {
    return (
      <EmptyState title="No service windows yet">
        <Button asChild className="mt-3">
          <Link href="/controller/windows">Open a window</Link>
        </Button>
      </EmptyState>
    );
  }
  const now = new Date();
  const selected =
    windows.find((w) => w.id === requested) ??
    windows.find((w) => w.endsAt > now && w.requestedCount > 0) ??
    windows.find((w) => w.endsAt > now) ??
    windows[0];
  const board = await getDispatchBoard(user, selected.id);

  return (
    <div className="grid gap-5">
      <nav aria-label="Service windows" className="flex gap-2 overflow-x-auto pb-1">
        {windows.map((w) => (
          <Link
            key={w.id}
            href={`/controller/dispatch?window=${w.id}`}
            aria-current={w.id === selected.id ? "page" : undefined}
            className={cn(
              "min-w-44 shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors",
              w.id === selected.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/50",
              w.endsAt < now && "opacity-60",
            )}
          >
            <span className="block font-medium">{formatWindow(w.startsAt, w.endsAt)}</span>
            <span className="text-xs text-muted-foreground">
              {w.requestedCount} waiting · {w.assignedCount} assigned · {formatMultiplier(w.multiplierBps)}
            </span>
          </Link>
        ))}
      </nav>

      <DispatchBoard
        key={board.window.id}
        windowId={board.window.id}
        windowLabel={board.window.label ?? formatWindow(board.window.startsAt, board.window.endsAt)}
        center={NEIGHBORHOOD_CENTER}
        waiting={board.requested.map(toCard)}
        cleaners={board.cleaners.map((c) => ({
          id: c.id,
          name: c.name,
          start: c.start,
          startIsHome: c.startIsHome,
          capacityMinutes: c.capacityMinutes,
          usedMinutes: c.usedMinutes,
          hasBlower: c.hasBlower,
          rentedBlower: c.rentedBlower,
          rating: c.rating,
          jobs: c.jobs.map(toCard),
        }))}
      />
    </div>
  );
}
