// The job lifecycle as a pure, unit-tested state machine.
// `transitionJob` in src/lib/dal/jobs.ts is the only code that changes a job's
// status, and it always asks `checkTransition` first.

import type { JobStatus, Role } from "./domain";

export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["REQUESTED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CONFIRMED", "DISPUTED"],
  DISPUTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: [],
  CANCELLED: [],
};

/** Who is asking for the transition. `system` is used by the 24-hour auto-confirm. */
export type Actor = { kind: "user"; id: string; role: Role } | { kind: "system" };

export type JobSnapshot = {
  status: JobStatus;
  homeownerId: string;
  cleanerId: string | null;
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

const deny = (reason: string): TransitionCheck => ({ ok: false, reason });

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

/** Validates both the edge (from → to) and who may take it, plus preconditions. */
export function checkTransition(job: JobSnapshot, to: JobStatus, actor: Actor): TransitionCheck {
  if (!canTransition(job.status, to)) {
    return deny(`A job that is ${job.status.toLowerCase().replace("_", " ")} cannot move to ${to.toLowerCase().replace("_", " ")}.`);
  }

  const isController = actor.kind === "user" && actor.role === "CONTROLLER";
  const isOwner = actor.kind === "user" && actor.role === "HOMEOWNER" && actor.id === job.homeownerId;
  const isAssignedCleaner =
    actor.kind === "user" && actor.role === "CLEANER" && job.cleanerId !== null && actor.id === job.cleanerId;
  const isSystem = actor.kind === "system";

  switch (`${job.status}->${to}`) {
    case "REQUESTED->ASSIGNED":
      if (!isController && !isSystem) return deny("Only the controller can assign jobs.");
      return { ok: true };

    case "ASSIGNED->REQUESTED":
      if (!isController) return deny("Only the controller can unassign jobs.");
      return { ok: true };

    case "REQUESTED->CANCELLED":
    case "ASSIGNED->CANCELLED":
      if (!isController && !isOwner) return deny("Only the homeowner or the controller can cancel this job.");
      return { ok: true };

    case "ASSIGNED->IN_PROGRESS":
      if (!isAssignedCleaner) return deny("Only the assigned cleaner can start this job.");
      if (!job.hasBeforePhoto) return deny("Upload a before photo to start the job.");
      return { ok: true };

    case "IN_PROGRESS->COMPLETED":
      if (!isAssignedCleaner) return deny("Only the assigned cleaner can complete this job.");
      if (!job.hasAfterPhoto) return deny("Upload an after photo to complete the job.");
      return { ok: true };

    case "COMPLETED->CONFIRMED":
      if (!isOwner && !isController && !isSystem) return deny("Only the homeowner can confirm this job.");
      return { ok: true };

    case "COMPLETED->DISPUTED":
      if (!isOwner) return deny("Only the homeowner can dispute this job.");
      return { ok: true };

    case "DISPUTED->CONFIRMED":
    case "DISPUTED->CANCELLED":
      if (!isController) return deny("Only the controller can resolve disputes.");
      return { ok: true };

    default:
      return deny("This transition is not allowed.");
  }
}

/** Statuses that occupy a cleaner's time in a window. */
export const ACTIVE_ASSIGNMENT_STATUSES: readonly JobStatus[] = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CONFIRMED", "DISPUTED"];

/** Ordered steps shown on the homeowner's delivery-style timeline. */
export const TIMELINE_STEPS: readonly JobStatus[] = ["REQUESTED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CONFIRMED"];
