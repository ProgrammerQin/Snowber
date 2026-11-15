import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { StatusBadge } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/contracts/domain";
import { listJobsForController } from "@/lib/dal/jobs";
import { requireRole } from "@/lib/dal/session";
import { firstName, formatMoney, formatWindow } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

export default function ControllerJobsPage({ searchParams }: PageProps<"/controller/jobs">) {
  return (
    <>
      <PageHeader title="Jobs" description="Every booking, newest first." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Jobs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/controller/jobs">["searchParams"] }) {
  const user = await requireRole("CONTROLLER");
  const { status } = await searchParams;
  const filter = typeof status === "string" && (JOB_STATUSES as readonly string[]).includes(status) ? (status as JobStatus) : undefined;
  const jobs = await listJobsForController(user, { status: filter });

  return (
    <div className="grid gap-4">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[undefined, ...JOB_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/controller/jobs?status=${s}` : "/controller/jobs"}
            aria-current={s === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              s === filter ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/50",
            )}
          >
            {s ? JOB_STATUS_LABEL[s] : "All"}
          </Link>
        ))}
      </nav>
      {jobs.length === 0 ? (
        <EmptyState title="No jobs match this filter" />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Homeowner</TableHead>
                  <TableHead>Cleaner</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const window = job.assignedWindow ?? job.windowOptions[0];
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link href={`/controller/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                          {job.property.address}
                        </Link>
                        {job.photos.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="size-3" aria-hidden /> flagged photo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {window ? formatWindow(window.startsAt, window.endsAt) : "—"}
                        {!job.assignedWindow && window && <span className="text-xs text-muted-foreground"> (first option)</span>}
                      </TableCell>
                      <TableCell>{firstName(job.homeowner.name)}</TableCell>
                      <TableCell>{job.cleaner ? firstName(job.cleaner.name) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(job.priceCents + job.tipCents)}</TableCell>
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
