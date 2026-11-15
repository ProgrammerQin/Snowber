"use server";

import { refresh } from "next/cache";
import { formToObject, runAction, type ActionResult } from "@/lib/action";
import {
  assignmentSchema,
  controllerAccountSchema,
  firstError,
  roleChangeSchema,
  toolSchema,
  toolStatusSchema,
  windowSchema,
} from "@/lib/contracts/schemas";
import { assignJobs, moveStop, suggestForWindow, unassignJob } from "@/lib/dal/dispatch";
import { resolveDispute } from "@/lib/dal/jobs";
import { requireRole } from "@/lib/dal/session";
import { createTool, decideRental, markRentalReturned, setToolStatus } from "@/lib/dal/tools";
import { createControllerAccount, setUserRole } from "@/lib/dal/users";
import { createWindow, setWindowStatus } from "@/lib/dal/windows";

export async function createWindowAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = windowSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await createWindow(user, parsed.data);
    refresh();
    return { ok: true, message: "Window opened. Homeowners can book it now." };
  });
}

export async function setWindowStatusAction(windowId: string, status: "OPEN" | "CLOSED"): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await setWindowStatus(user, windowId, status);
    refresh();
    return { ok: true, message: status === "OPEN" ? "Window reopened." : "Window closed to new bookings." };
  });
}

export async function suggestAction(windowId: string) {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    return { ok: true, data: await suggestForWindow(user, windowId) };
  });
}

export async function assignAction(input: { windowId: string; assignments: { jobId: string; cleanerId: string }[] }): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = assignmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const count = await assignJobs(user, parsed.data.windowId, parsed.data.assignments);
    refresh();
    return { ok: true, message: count === 1 ? "Job assigned." : `${count} jobs assigned.` };
  });
}

export async function unassignAction(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await unassignJob(user, jobId);
    refresh();
    return { ok: true, message: "Job moved back to the waiting list." };
  });
}

export async function moveStopAction(jobId: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await moveStop(user, jobId, direction);
    refresh();
    return { ok: true };
  });
}

export async function resolveDisputeAction(jobId: string, outcome: "pay-cleaner" | "refund"): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await resolveDispute(user, jobId, outcome);
    refresh();
    return { ok: true, message: outcome === "pay-cleaner" ? "Dispute closed; the cleaner was paid." : "Dispute closed; the homeowner was refunded." };
  });
}

export async function createToolAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = toolSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await createTool(user, parsed.data);
    refresh();
    return { ok: true, message: "Tool added to the library." };
  });
}

export async function setToolStatusAction(toolId: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = toolStatusSchema.safeParse({ toolId, status });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await setToolStatus(user, parsed.data.toolId, parsed.data.status);
    refresh();
    return { ok: true, message: "Tool updated." };
  });
}

export async function decideRentalAction(rentalId: string, approve: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await decideRental(user, rentalId, approve);
    refresh();
    return { ok: true, message: approve ? "Rental approved and fee charged." : "Rental declined." };
  });
}

export async function markReturnedAction(rentalId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    await markRentalReturned(user, rentalId);
    refresh();
    return { ok: true, message: "Marked as returned." };
  });
}

export async function createControllerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = controllerAccountSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const created = await createControllerAccount(user, parsed.data);
    refresh();
    return { ok: true, message: `Controller account created for ${created.email}.` };
  });
}

export async function setRoleAction(userId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireRole("CONTROLLER");
    const parsed = roleChangeSchema.safeParse({ userId, role });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await setUserRole(user, parsed.data.userId, parsed.data.role);
    refresh();
    return { ok: true, message: "Role updated." };
  });
}
