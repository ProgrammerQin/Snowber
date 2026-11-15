import "server-only";
import { prisma } from "@/lib/prisma";
import { invalid, notFound } from "@/lib/errors";
import { publish } from "@/lib/events";
import { assertRole, type CurrentUser } from "./session";

/** Open windows a homeowner can still book (starting in the future, next two weeks). */
export async function listBookableWindows(user: CurrentUser) {
  assertRole(user, "HOMEOWNER");
  const now = new Date();
  return prisma.serviceWindow.findMany({
    where: { status: "OPEN", startsAt: { gt: now, lt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
  });
}

export async function listWindowsForController(user: CurrentUser) {
  assertRole(user, "CONTROLLER");
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return prisma.serviceWindow.findMany({
    where: { endsAt: { gte: since } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { optionJobs: true, assignedJobs: true } } },
  });
}

export async function createWindow(
  user: CurrentUser,
  input: { label?: string; startsAt: Date; endsAt: Date; multiplierBps: number },
) {
  assertRole(user, "CONTROLLER");
  if (input.endsAt.getTime() < Date.now()) throw invalid("That window has already ended.");
  const window = await prisma.serviceWindow.create({
    data: { ...input, createdById: user.id },
  });
  publish({ type: "window.updated", message: "New service window opened", audience: { userIds: [], controllers: true } });
  return window;
}

export async function setWindowStatus(user: CurrentUser, windowId: string, status: "OPEN" | "CLOSED") {
  assertRole(user, "CONTROLLER");
  const exists = await prisma.serviceWindow.findUnique({ where: { id: windowId }, select: { id: true } });
  if (!exists) throw notFound("That window no longer exists.");
  await prisma.serviceWindow.update({ where: { id: windowId }, data: { status } });
  publish({ type: "window.updated", audience: { userIds: [], controllers: true } });
}
