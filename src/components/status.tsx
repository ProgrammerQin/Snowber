import { Check, CircleDot } from "lucide-react";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/contracts/domain";
import { TIMELINE_STEPS } from "@/lib/contracts/job-states";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const VARIANT: Record<JobStatus, "muted" | "info" | "warning" | "default" | "success" | "destructive" | "secondary"> = {
  REQUESTED: "secondary",
  ASSIGNED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "default",
  CONFIRMED: "success",
  DISPUTED: "destructive",
  CANCELLED: "muted",
};

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}

type TimelineJob = {
  status: JobStatus;
  createdAt: Date;
  assignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  confirmedAt: Date | null;
};

const STEP_TEXT: Record<string, string> = {
  REQUESTED: "Requested",
  ASSIGNED: "Cleaner assigned",
  IN_PROGRESS: "Clearing started",
  COMPLETED: "Done — photos ready",
  CONFIRMED: "Confirmed",
};

/** Delivery-style progress tracker for the homeowner. */
export function JobTimeline({ job }: { job: TimelineJob }) {
  const times: Record<string, Date | null> = {
    REQUESTED: job.createdAt,
    ASSIGNED: job.assignedAt,
    IN_PROGRESS: job.startedAt,
    COMPLETED: job.completedAt,
    CONFIRMED: job.confirmedAt,
  };
  const effective = job.status === "DISPUTED" ? "COMPLETED" : job.status;
  const currentIndex = TIMELINE_STEPS.indexOf(effective);

  return (
    <ol className="grid gap-0" aria-label="Job progress">
      {TIMELINE_STEPS.map((step, i) => {
        const done = job.status !== "CANCELLED" && currentIndex >= i;
        const current = currentIndex === i && job.status !== "CONFIRMED" && job.status !== "CANCELLED";
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {i < TIMELINE_STEPS.length - 1 && (
              <span aria-hidden className={cn("absolute top-7 left-[13px] h-[calc(100%-1.5rem)] w-0.5", done && currentIndex > i ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
                current && "ring-4 ring-primary/20",
              )}
            >
              {done && !current ? <Check className="size-4" aria-hidden /> : <CircleDot className="size-3.5" aria-hidden />}
            </span>
            <div className="pt-0.5">
              <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>
                {STEP_TEXT[step]}
                {current && <span className="sr-only"> (current step)</span>}
              </p>
              {times[step] && done && <p className="text-xs text-muted-foreground">{formatDateTime(times[step]!)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Stars({ rating, count, className }: { rating: number | null | undefined; count?: number; className?: string }) {
  if (rating == null) return <span className={cn("text-xs text-muted-foreground", className)}>No ratings yet</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)} aria-label={`${rating} out of 5 stars`}>
      <span className="text-amber-500" aria-hidden>
        {"★".repeat(Math.round(rating))}
        <span className="text-muted-foreground/40">{"★".repeat(5 - Math.round(rating))}</span>
      </span>
      <span className="text-muted-foreground">
        {rating.toFixed(1)}
        {count != null && ` (${count})`}
      </span>
    </span>
  );
}
