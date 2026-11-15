import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Navigation, Snowflake } from "lucide-react";
import { JobPhotos } from "@/components/job-photos";
import { PageSkeleton } from "@/components/page";
import { PhotoUploader } from "@/components/photo-uploader";
import { ReviewForm } from "@/components/review-form";
import { Stars, StatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/misc";
import { AUTO_CONFIRM_HOURS } from "@/lib/config";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { getCleanerJob } from "@/lib/dal/jobs";
import { requireRole } from "@/lib/dal/session";
import { AppError } from "@/lib/errors";
import { firstName, formatMinutes, formatMoney, formatWindow } from "@/lib/format";
import { cleanerPayout } from "@/lib/pricing";

export default function CleanerJobPage(props: PageProps<"/cleaner/jobs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CleanerJob params={props.params} />
    </Suspense>
  );
}

async function CleanerJob({ params }: { params: PageProps<"/cleaner/jobs/[id]">["params"] }) {
  const user = await requireRole("CLEANER");
  const { id } = await params;
  const job = await getCleanerJob(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const directions = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${job.property.lat},${job.property.lng}`;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/cleaner">
            <ArrowLeft aria-hidden /> My route
          </Link>
        </Button>
        <StatusBadge status={job.status} className="ml-auto text-sm" />
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Stop {job.routeOrder ?? "–"}</p>
        <h1 className="text-2xl font-semibold">{job.property.address}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden />
            {job.assignedWindow ? formatWindow(job.assignedWindow.startsAt, job.assignedWindow.endsAt) : "Not scheduled"}
          </span>
          <span>· {LOT_SIZE_LABEL[job.property.lotSize]}</span>
          <span>· about {formatMinutes(job.estMinutes)}</span>
        </div>
      </div>

      <Button asChild size="xl" variant="outline">
        <a href={directions} target="_blank" rel="noreferrer">
          <Navigation aria-hidden /> Walking directions
        </a>
      </Button>

      {job.status === "ASSIGNED" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Before you start</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">Take one photo showing the snow on the driveway{job.includeSidewalk && " and sidewalk"}. This starts the job.</p>
            <PhotoUploader jobId={job.id} kind="BEFORE" label="Take before photo & start" />
          </CardContent>
        </Card>
      )}
      {job.status === "IN_PROGRESS" && (
        <Card>
          <CardHeader>
            <CardTitle>2. When you&apos;re done</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">Take the after photo from the same spot as the before photo. This finishes the job.</p>
            <PhotoUploader jobId={job.id} kind="AFTER" label="Take after photo & finish" />
          </CardContent>
        </Card>
      )}
      {job.status === "COMPLETED" && (
        <Alert variant="success">
          <AlertTitle>Nice work!</AlertTitle>
          <AlertDescription>
            Waiting for the homeowner to confirm. You&apos;ll be credited {formatMoney(cleanerPayout(job.priceCents) + job.tipCents)} when they do, or
            automatically after {AUTO_CONFIRM_HOURS} hours.
          </AlertDescription>
        </Alert>
      )}
      {job.status === "DISPUTED" && (
        <Alert variant="destructive">
          <AlertTitle>The homeowner reported a problem</AlertTitle>
          <AlertDescription>The controller is reviewing the photos and will contact you.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {job.includeSidewalk && <Badge variant="secondary">Sidewalk</Badge>}
            {job.includeSalt && <Badge variant="secondary">Salt</Badge>}
            {job.requiresBlower && (
              <Badge variant="warning">
                <Snowflake aria-hidden /> Bring a snow blower
              </Badge>
            )}
          </div>
          {(job.property.notes || job.notes) && (
            <div className="rounded-md bg-muted p-3">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <MapPin className="size-4" aria-hidden /> Notes from the homeowner
              </p>
              {job.property.notes && <p>{job.property.notes}</p>}
              {job.notes && <p>{job.notes}</p>}
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Homeowner</span>
            <span className="flex items-center gap-2">
              {firstName(job.homeowner.name)} <Stars rating={job.homeownerRating?.average} />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You earn</span>
            <span className="font-medium">
              {formatMoney(cleanerPayout(job.priceCents) + job.tipCents)}
              {job.tipCents > 0 && ` (incl. ${formatMoney(job.tipCents)} tip)`}
            </span>
          </div>
        </CardContent>
      </Card>

      {job.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <JobPhotos photos={job.photos} />
          </CardContent>
        </Card>
      )}

      {job.status === "CONFIRMED" && (
        <Card>
          <CardHeader>
            <CardTitle>Rate this house</CardTitle>
          </CardHeader>
          <CardContent>
            {job.myReview ? (
              <Stars rating={job.myReview.rating} />
            ) : (
              <ReviewForm jobId={job.id} prompt="Was the job as described? (accurate size, safe access, friendly homeowner)" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
