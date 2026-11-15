import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_HOME, isRole, type Role } from "@/lib/contracts/domain";
import type { Actor } from "@/lib/contracts/job-states";
import { forbidden } from "@/lib/errors";

// Session helpers for the data-access layer. Pages call these inside a <Suspense>
// boundary (reading headers is request-time work under Cache Components), and
// every DAL function re-checks the role it needs, so a page guard is never the
// only protection.

export type CurrentUser = { id: string; name: string; email: string; role: Role };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = isRole(session.user.role) ? session.user.role : "HOMEOWNER";
  return { id: session.user.id, name: session.user.name, email: session.user.email, role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** For pages and actions: sends the user to their own home if the role does not match. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** For DAL functions: throws instead of redirecting. */
export function assertRole(user: CurrentUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) throw forbidden();
}

export function actorOf(user: CurrentUser): Actor {
  return { kind: "user", id: user.id, role: user.role };
}
