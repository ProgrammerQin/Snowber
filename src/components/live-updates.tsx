"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EVENT_TYPES, type ClientEvent } from "@/lib/contracts/events";
import { cn } from "@/lib/utils";

// Subscribes to /api/events (Server-Sent Events). Events are hints, not data:
// on any event, or after a reconnect, the page re-fetches its server components
// with router.refresh(), so a missed message can never leave stale state.
// While the stream is down, the page falls back to polling every 10 seconds.

type Status = "connecting" | "live" | "offline";

export function LiveUpdates({ className }: { className?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let live = false;
    let connectedBefore = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => {
      live = true;
      setStatus("live");
      if (connectedBefore) scheduleRefresh();
      connectedBefore = true;
    });
    const onEvent = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as ClientEvent;
        if (data.message) toast(data.message);
      } catch {
        // Ignore malformed payloads; the refresh below still runs.
      }
      scheduleRefresh();
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, onEvent as EventListener);
    source.onerror = () => {
      live = false;
      setStatus("offline");
    };

    const poll = setInterval(() => {
      if (!live) router.refresh();
    }, 10_000);

    return () => {
      source.close();
      clearInterval(poll);
      clearTimeout(refreshTimer);
    };
  }, [router]);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      aria-live="polite"
      title={status === "live" ? "Updates arrive in real time" : "Trying to reconnect; refreshing every 10 seconds"}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status === "live" ? "bg-success" : status === "connecting" ? "bg-warning" : "bg-destructive animate-pulse",
        )}
      />
      {status === "live" ? "Live" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
    </span>
  );
}
