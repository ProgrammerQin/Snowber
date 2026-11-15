import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/contracts/domain";
import { conflict, invalid, isUniqueViolation, notFound } from "@/lib/errors";
import { geocodeAddress } from "@/lib/geocode";
import { ratingSummary } from "./reviews";
import { assertRole, type CurrentUser } from "./session";

export async function listUsers(user: CurrentUser) {
  assertRole(user, "CONTROLLER");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      ownsBlower: true,
      _count: { select: { properties: true, jobsAsCleaner: true, jobsAsHomeowner: true } },
    },
  });
  const ratings = await ratingSummary(users.map((u) => u.id));
  return users.map((u) => ({ ...u, rating: ratings.get(u.id) ?? null }));
}

/**
 * Only controllers create controller accounts. The user and its credential account
 * are written directly (the same rows Better Auth's sign-up creates), so the
 * controller's own session is not replaced by the new account.
 */
export async function createControllerAccount(user: CurrentUser, input: { name: string; email: string; password: string }) {
  assertRole(user, "CONTROLLER");
  const id = randomUUID();
  const password = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: {
        id,
        name: input.name,
        email: input.email,
        emailVerified: false,
        role: "CONTROLLER",
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
      },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("An account with that email already exists.");
    throw error;
  }
}

export async function setUserRole(user: CurrentUser, userId: string, role: Role) {
  assertRole(user, "CONTROLLER");
  if (userId === user.id) throw invalid("You can't change your own role.");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) throw notFound("We couldn't find that user.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function getMyProfile(user: CurrentUser) {
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, phone: true, homeAddress: true, homeLat: true, homeLng: true, ownsBlower: true },
  });
  if (!profile) throw notFound();
  const rating = (await ratingSummary([user.id])).get(user.id) ?? null;
  return { ...profile, rating };
}

/** Cleaners set where their routes start and whether they own a snow blower. */
export async function updateCleanerProfile(
  user: CurrentUser,
  input: { phone?: string; homeAddress?: string; ownsBlower: boolean },
) {
  assertRole(user, "CLEANER");
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { homeAddress: true } });
  let position: { homeLat: number | null; homeLng: number | null } | undefined;
  if (!input.homeAddress) {
    position = { homeLat: null, homeLng: null };
  } else if (input.homeAddress !== current?.homeAddress) {
    const result = await geocodeAddress(input.homeAddress);
    position = { homeLat: result.lat, homeLng: result.lng };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { phone: input.phone ?? null, homeAddress: input.homeAddress ?? null, ownsBlower: input.ownsBlower, ...position },
  });
}
