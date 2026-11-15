"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { createPhotoUploadAction, finalizePhotoAction } from "@/app/actions/cleaner";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/config";
import { Button } from "./ui/button";
import { Progress } from "./ui/misc";

// One big button that opens the phone camera. The photo goes straight to cloud
// storage through a presigned URL (with progress and automatic retries on weak
// signal), then the server processes it and advances the job.

type Phase = "idle" | "uploading" | "processing" | "error";

export function PhotoUploader({ jobId, kind, label }: { jobId: string; kind: "BEFORE" | "AFTER"; label: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setLastFile(file);
    setError(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const prepared = file.size > MAX_UPLOAD_BYTES ? await shrink(file) : file;
      const contentType = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(prepared.type) ? prepared.type : "image/jpeg";
      const target = await createPhotoUploadAction({ jobId, kind, contentType, size: prepared.size });
      if (!target.ok || !target.data) throw new Error(target.ok ? "Could not start the upload." : target.error);

      await putWithRetry(target.data.url, prepared, target.data.headers, setProgress);

      setPhase("processing");
      const result = await finalizePhotoAction({ jobId, kind, key: target.data.key });
      if (!result.ok) throw new Error(result.error);
      toast.success(kind === "BEFORE" ? "Before photo saved — job started" : "After photo saved — job complete");
      setPhase("idle");
      router.refresh();
    } catch (e) {
      setPhase("error");
      setError((e as Error).message || "Upload failed.");
    }
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="grid gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        capture="environment"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`photo-input-${kind.toLowerCase()}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button size="xl" className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
        {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Checking photo…" : label}
      </Button>
      {phase === "uploading" && <Progress value={Math.round(progress * 100)} aria-label="Upload progress" />}
      {phase === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <span>{error}</span>
          {lastFile && (
            <Button size="sm" variant="outline" onClick={() => upload(lastFile)}>
              <RotateCcw aria-hidden /> Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error — check your signal."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.timeout = 120_000;
    xhr.send(body);
  });
}

async function putWithRetry(url: string, body: Blob, headers: Record<string, string>, onProgress: (p: number) => void) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await put(url, body, headers, onProgress);
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** Only for photos over the size limit: re-encode at 2560px (this drops EXIF). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo."))), "image/jpeg", 0.88),
  );
}
