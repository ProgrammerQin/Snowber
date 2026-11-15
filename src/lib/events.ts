import "server-only";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ClientEvent, SnowberEvent } from "./contracts/events";

// In-process event bus feeding the SSE endpoint (src/app/api/events/route.ts).
// It lives on globalThis so route handlers and server actions share one instance.
// Running more than one server process would require PostgreSQL LISTEN/NOTIFY
// (or Redis pub/sub) behind the same publish/subscribe functions.

const globalForBus = globalThis as unknown as { __snowberBus?: EventEmitter };
const bus = globalForBus.__snowberBus ?? new EventEmitter();
bus.setMaxListeners(0);
globalForBus.__snowberBus = bus;

export type PendingEvent = Omit<SnowberEvent, "id" | "at">;

export function publish(event: PendingEvent): void {
  bus.emit("event", { ...event, id: randomUUID(), at: new Date().toISOString() } satisfies SnowberEvent);
}

export function publishAll(events: readonly PendingEvent[]): void {
  for (const event of events) publish(event);
}

export function subscribe(listener: (event: SnowberEvent) => void): () => void {
  bus.on("event", listener);
  return () => {
    bus.off("event", listener);
  };
}

export function canReceive(user: { id: string; role: string }, event: SnowberEvent): boolean {
  return (event.audience.controllers && user.role === "CONTROLLER") || event.audience.userIds.includes(user.id);
}

/** Strips the audience list before an event is sent to a browser. */
export function toClientEvent(event: SnowberEvent): ClientEvent {
  return { id: event.id, type: event.type, at: event.at, jobId: event.jobId, status: event.status, message: event.message };
}
