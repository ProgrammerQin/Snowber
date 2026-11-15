"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        {error.message && !error.digest ? error.message : "Please try again. If it keeps happening, contact the controller."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
