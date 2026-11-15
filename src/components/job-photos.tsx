/* eslint-disable @next/next/no-img-element -- photos come from short-lived signed URLs */
import { AlertTriangle, Download } from "lucide-react";
import type { PhotoView } from "@/lib/dal/media";
import { formatDateTime } from "@/lib/format";
import { BeforeAfterSlider } from "./before-after-slider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

/** Before/after viewer plus the stored proof-of-service image and every thumbnail. */
export function JobPhotos({
  photos,
  comparisonUrl,
  showFlags = false,
}: {
  photos: PhotoView[];
  comparisonUrl?: string | null;
  showFlags?: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-muted-foreground">No photos yet.</p>;
  const before = photos.find((p) => p.kind === "BEFORE");
  const after = [...photos].reverse().find((p) => p.kind === "AFTER");

  return (
    <div className="grid gap-4">
      {before && after && <BeforeAfterSlider beforeUrl={before.displayUrl} afterUrl={after.displayUrl} />}
      {comparisonUrl && (
        <Button asChild variant="outline" size="sm" className="w-fit">
          <a href={comparisonUrl} target="_blank" rel="noreferrer" download="snowber-proof-of-service.jpg">
            <Download aria-hidden /> Proof-of-service image
          </a>
        </Button>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <li key={photo.id} className="grid gap-1">
            <a href={photo.displayUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
              <img src={photo.thumbUrl} alt={`${photo.kind === "BEFORE" ? "Before" : "After"} photo`} className="aspect-[4/3] w-full object-cover" />
            </a>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Badge variant={photo.kind === "BEFORE" ? "secondary" : "success"}>{photo.kind === "BEFORE" ? "Before" : "After"}</Badge>
              <span>{photo.takenAt ? `taken ${formatDateTime(photo.takenAt)}` : `uploaded ${formatDateTime(photo.createdAt)}`}</span>
            </div>
            {showFlags && photo.flagged && (
              <p className="flex items-start gap-1 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {photo.flagReason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
