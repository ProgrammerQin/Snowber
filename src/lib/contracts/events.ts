// Real-time event contract shared by the server event bus, the SSE route and the client hook.

import type { JobStatus } from "./domain";

export const EVENT_TYPES = [
  "job.created",
  "job.updated",
  "dispatch.updated",
  "rental.updated",
  "ledger.updated",
  "window.updated",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Who receives an event. Controllers see everything flagged `controllers`. */
export type Audience = { userIds: string[]; controllers: boolean };

export type SnowberEvent = {
  id: string;
  type: EventType;
  at: string;
  jobId?: string;
  status?: JobStatus;
  /** Optional human-readable message; clients show it as a toast. */
  message?: string;
  audience: Audience;
};

/** The part of an event that is sent to browsers (no audience list). */
export type ClientEvent = Omit<SnowberEvent, "audience">;
