import { describe, expect, it } from "vitest";
import { canTransition, checkTransition, type Actor, type JobSnapshot } from "@/lib/contracts/job-states";

const homeowner: Actor = { kind: "user", id: "home-1", role: "HOMEOWNER" };
const otherHomeowner: Actor = { kind: "user", id: "home-2", role: "HOMEOWNER" };
const cleaner: Actor = { kind: "user", id: "clean-1", role: "CLEANER" };
const otherCleaner: Actor = { kind: "user", id: "clean-2", role: "CLEANER" };
const controller: Actor = { kind: "user", id: "ctrl-1", role: "CONTROLLER" };
const system: Actor = { kind: "system" };

function job(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return { status: "REQUESTED", homeownerId: "home-1", cleanerId: null, hasBeforePhoto: false, hasAfterPhoto: false, ...overrides };
}

describe("transition graph", () => {
  it("allows the happy path", () => {
    expect(canTransition("REQUESTED", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "CONFIRMED")).toBe(true);
  });

  it("never leaves terminal states", () => {
    expect(canTransition("CONFIRMED", "DISPUTED")).toBe(false);
    expect(canTransition("CANCELLED", "REQUESTED")).toBe(false);
  });

  it("cannot skip steps", () => {
    expect(checkTransition(job(), "COMPLETED", controller).ok).toBe(false);
    expect(checkTransition(job({ status: "IN_PROGRESS", cleanerId: "clean-1" }), "CANCELLED", controller).ok).toBe(false);
  });
});

describe("who may move a job", () => {
  it("only the controller (or system) assigns", () => {
    expect(checkTransition(job(), "ASSIGNED", controller).ok).toBe(true);
    expect(checkTransition(job(), "ASSIGNED", system).ok).toBe(true);
    expect(checkTransition(job(), "ASSIGNED", homeowner).ok).toBe(false);
    expect(checkTransition(job(), "ASSIGNED", cleaner).ok).toBe(false);
  });

  it("only the owning homeowner or the controller cancels", () => {
    expect(checkTransition(job(), "CANCELLED", homeowner).ok).toBe(true);
    expect(checkTransition(job(), "CANCELLED", controller).ok).toBe(true);
    expect(checkTransition(job(), "CANCELLED", otherHomeowner).ok).toBe(false);
    expect(checkTransition(job({ status: "ASSIGNED", cleanerId: "clean-1" }), "CANCELLED", cleaner).ok).toBe(false);
  });

  it("only the assigned cleaner starts, and only with a before photo", () => {
    const assigned = job({ status: "ASSIGNED", cleanerId: "clean-1" });
    expect(checkTransition(assigned, "IN_PROGRESS", cleaner)).toEqual({ ok: false, reason: "Upload a before photo to start the job." });
    expect(checkTransition({ ...assigned, hasBeforePhoto: true }, "IN_PROGRESS", cleaner).ok).toBe(true);
    expect(checkTransition({ ...assigned, hasBeforePhoto: true }, "IN_PROGRESS", otherCleaner).ok).toBe(false);
    expect(checkTransition({ ...assigned, hasBeforePhoto: true }, "IN_PROGRESS", controller).ok).toBe(false);
  });

  it("completing requires an after photo", () => {
    const working = job({ status: "IN_PROGRESS", cleanerId: "clean-1", hasBeforePhoto: true });
    expect(checkTransition(working, "COMPLETED", cleaner).ok).toBe(false);
    expect(checkTransition({ ...working, hasAfterPhoto: true }, "COMPLETED", cleaner).ok).toBe(true);
  });

  it("the homeowner confirms or disputes; the system can auto-confirm", () => {
    const done = job({ status: "COMPLETED", cleanerId: "clean-1", hasBeforePhoto: true, hasAfterPhoto: true });
    expect(checkTransition(done, "CONFIRMED", homeowner).ok).toBe(true);
    expect(checkTransition(done, "CONFIRMED", system).ok).toBe(true);
    expect(checkTransition(done, "CONFIRMED", cleaner).ok).toBe(false);
    expect(checkTransition(done, "DISPUTED", homeowner).ok).toBe(true);
    expect(checkTransition(done, "DISPUTED", otherHomeowner).ok).toBe(false);
    expect(checkTransition(done, "DISPUTED", system).ok).toBe(false);
  });

  it("only the controller resolves disputes", () => {
    const disputed = job({ status: "DISPUTED", cleanerId: "clean-1" });
    expect(checkTransition(disputed, "CONFIRMED", controller).ok).toBe(true);
    expect(checkTransition(disputed, "CANCELLED", controller).ok).toBe(true);
    expect(checkTransition(disputed, "CONFIRMED", homeowner).ok).toBe(false);
  });
});
