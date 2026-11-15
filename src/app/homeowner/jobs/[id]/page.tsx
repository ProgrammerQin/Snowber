import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { cancelJobAction, confirmJobAction } from "@/app/actions/homeowner";
import { ActionButton } from "@/components/forms";
import { JobPhotos } from "@/components/job-photos";
import { PageSkeleton } from "@/components/page";
import { ReviewForm } from "@/components/review-form";
import { JobTimeline, Stars, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/misc";
import { AUTO_CONFIRM_HOURS } from "@/lib/config";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { getHomeownerJob } from "@/lib/dal/jobs";
import { requireRole } from "@/lib/dal/session";
import { AppError } from "@/lib/errors";
import { firstName, formatMoney, formatWindow } from "@/lib/format";
import { DisputeButton } from "./dispute-form";

export default function HomeownerJobPage(props: PageProps<"/homeowner/jobs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JobDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function JobDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/homeowner/jobs/[id]">["params"];
  searchParams: PageProps<"/homeowner/jobs/[id]">["searchParams"];
}) {
  const user = await requireRole("HOMEOWNER");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const job = await getHomeownerJob(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const refunded = job.payment?.refundedCents ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/homeowner">
            <ArrowLeft aria-hidden /> My jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{job.property.label ?? job.property.address}</h1>
        <StatusBadge status={job.status} className="text-sm" />
      </div>

      {query.booked === "1" && job.status === "REQUESTED" && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertTitle>You&apos;re booked</AlertTitle>
          <AlertDescription>We&apos;ll let you know here as soon as a cleaner is assigned.</AlertDescription>
        </Alert>
      )}
      {job.status === "COMPLETED" && (
        <Alert variant="warning">
          <AlertTitle>Your cleaner is done</AlertTitle>
          <AlertDescription>
            Check the photos below and confirm. If you don&apos;t respond, the job is confirmed automatically after {AUTO_CONFIRM_HOURS} hours.
          </AlertDescription>
        </Alert>
      )}
      {job.status === "DISPUTED" && (
        <Alert variant="destructive">
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>You reported: “{job.disputeReason}”. The controller will follow up.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {job.status === "CANCELLED" ? <p className="text-sm text-muted-foreground">This job was cancelled.</p> : <JobTimeline job={job} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>{job.property.address}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Detail label="When">
                {job.assignedWindow ? (
                  formatWindow(job.assignedWindow.startsAt, job.assignedWindow.endsAt)
                ) : (
                  <ul className="text-right">
                    {job.windowOptions.map((w) => (
                      <li key={w.id}>{formatWindow(w.startsAt, w.endsAt)}</li>
                    ))}
                  </ul>
                )}
              </Detail>
              <Detail label="Driveway">{LOT_SIZE_LABEL[job.property.lotSize]}</Detail>
              <Detail label="Extras">
                {[job.includeSidewalk && "sidewalk", job.includeSalt && "salt"].filter(Boolean).join(", ") || "none"}
              </Detail>
              <Detail label="Price">{formatMoney(job.priceCents)}</Detail>
              {job.tipCents > 0 && <Detail label="Tip">{formatMoney(job.tipCents)}</Detail>}
              {refunded > 0 && <Detail label="Refunded">{formatMoney(refunded)}</Detail>}
              {job.notes && <Detail label="Your notes">{job.notes}</Detail>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your cleaner</CardTitle>
            </CardHeader>
            <CardContent>
              {job.cleaner ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium">{firstName(job.cleaner.name)}</span>
                  <Stars rating={job.cleanerRating?.average} count={job.cleanerRating?.count} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">The controller assigns nearby cleaners before each window starts.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Before &amp; after</CardTitle>
              <CardDescription>Photos appear here as soon as your cleaner takes them.</CardDescription>
            </CardHeader>
            <CardContent>
              <JobPhotos photos={job.photos} comparisonUrl={job.comparisonUrl} />
            </CardContent>
          </Card>

          {(job.status === "COMPLETED" || job.status === "REQUESTED" || job.status === "ASSIGNED") && (
            <Card>
              <CardContent className="flex flex-wrap gap-3">
                {job.status === "COMPLETED" && (
                  <>
                    <ActionButton action={confirmJobAction.bind(null, job.id)} size="lg" variant="success">
                      <CheckCircle2 aria-hidden /> Looks good — confirm
                    </ActionButton>
                    <DisputeButton jobId={job.id} />
                  </>
                )}
                {(job.status === "REQUESTED" || job.status === "ASSIGNED") && (
                  <ActionButton
                    action={cancelJobAction.bind(null, job.id)}
                    variant="outline"
                    confirm={{
                      title: "Cancel this booking?",
                      description: "You'll get a full refund. Your cleaner (if assigned) will be told right away.",
                      confirmLabel: "Cancel booking",
                      destructive: true,
                    }}
                  >
                    Cancel booking
                  </ActionButton>
                )}
              </CardContent>
            </Card>
          )}

          {job.status === "CONFIRMED" && job.cleaner && (
            <Card>
              <CardHeader>
                <CardTitle>Review</CardTitle>
              </CardHeader>
              <CardContent>
                {job.myReview ? (
                  <div className="grid gap-1 text-sm">
                    <Stars rating={job.myReview.rating} />
                    {job.myReview.comment && <p className="text-muted-foreground">“{job.myReview.comment}”</p>}
                  </div>
                ) : (
                  <ReviewForm jobId={job.id} prompt={`How did ${firstName(job.cleaner.name)} do?`} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
