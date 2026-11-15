import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveDisputeAction, unassignAction } from "@/app/actions/controller";
import { cancelJobAction } from "@/app/actions/homeowner";
import { ActionButton } from "@/components/forms";
import { JobPhotos } from "@/components/job-photos";
import { PageSkeleton } from "@/components/page";
import { JobTimeline, Stars, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/misc";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { getJobForController } from "@/lib/dal/jobs";
import { requireRole } from "@/lib/dal/session";
import { AppError } from "@/lib/errors";
import { formatDateTime, formatMoney, formatWindow } from "@/lib/format";

export default function ControllerJobPage(props: PageProps<"/controller/jobs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ControllerJob params={props.params} />
    </Suspense>
  );
}

async function ControllerJob({ params }: { params: PageProps<"/controller/jobs/[id]">["params"] }) {
  const user = await requireRole("CONTROLLER");
  const { id } = await params;
  const job = await getJobForController(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/controller/jobs">
            <ArrowLeft aria-hidden /> Jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{job.property.address}</h1>
        <StatusBadge status={job.status} className="text-sm" />
      </div>

      {job.status === "DISPUTED" && (
        <Alert variant="destructive">
          <AlertTitle>Disputed by {job.homeowner.name}</AlertTitle>
          <AlertDescription>
            <p>“{job.disputeReason}”</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton action={resolveDisputeAction.bind(null, job.id, "pay-cleaner")} size="sm" variant="success">
                Photos look fine — pay the cleaner
              </ActionButton>
              <ActionButton
                action={resolveDisputeAction.bind(null, job.id, "refund")}
                size="sm"
                variant="destructive"
                confirm={{ title: "Refund the homeowner?", description: "The job is cancelled and the cleaner is not paid.", confirmLabel: "Refund", destructive: true }}
              >
                Refund the homeowner
              </ActionButton>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Row label="Homeowner">
                {job.homeowner.name} <span className="text-muted-foreground">({job.homeowner.email})</span>
              </Row>
              <Row label="Cleaner">{job.cleaner ? `${job.cleaner.name} (${job.cleaner.email})` : "—"}</Row>
              <Row label="Window">
                {job.assignedWindow ? formatWindow(job.assignedWindow.startsAt, job.assignedWindow.endsAt) : `${job.windowOptions.length} option(s)`}
              </Row>
              <Row label="Lot">{LOT_SIZE_LABEL[job.property.lotSize]}</Row>
              <Row label="Extras">{[job.includeSidewalk && "sidewalk", job.includeSalt && "salt"].filter(Boolean).join(", ") || "none"}</Row>
              <Row label="Price / tip">
                {formatMoney(job.priceCents)} / {formatMoney(job.tipCents)}
              </Row>
              {job.payment && (
                <Row label="Payment">
                  {job.payment.status.toLowerCase().replace("_", " ")} · {formatMoney(job.payment.amountCents)} charged
                  {job.payment.refundedCents > 0 && `, ${formatMoney(job.payment.refundedCents)} refunded`}
                </Row>
              )}
              {job.ledgerEntries.map((entry) => (
                <Row key={entry.id} label="Cleaner credited">
                  {formatMoney(entry.amountCents)} on {formatDateTime(entry.createdAt)}
                </Row>
              ))}
              {job.notes && <Row label="Notes">{job.notes}</Row>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>{job.status === "CANCELLED" ? <p className="text-sm">Cancelled {job.cancelledAt && formatDateTime(job.cancelledAt)}</p> : <JobTimeline job={job} />}</CardContent>
          </Card>

          {(job.status === "REQUESTED" || job.status === "ASSIGNED") && (
            <Card>
              <CardContent className="flex flex-wrap gap-2">
                {job.status === "ASSIGNED" && (
                  <ActionButton action={unassignAction.bind(null, job.id)} variant="outline">
                    Unassign
                  </ActionButton>
                )}
                <ActionButton
                  action={cancelJobAction.bind(null, job.id)}
                  variant="destructive"
                  confirm={{ title: "Cancel and refund this job?", confirmLabel: "Cancel job", destructive: true }}
                >
                  Cancel &amp; refund
                </ActionButton>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <JobPhotos photos={job.photos} comparisonUrl={job.comparisonUrl} showFlags />
            </CardContent>
          </Card>
          {job.reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {job.reviews.map((review) => (
                  <div key={review.id}>
                    <p className="flex items-center gap-2 font-medium">
                      {review.author.name} ({review.author.role.toLowerCase()}) <Stars rating={review.rating} />
                    </p>
                    {review.comment && <p className="text-muted-foreground">“{review.comment}”</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
