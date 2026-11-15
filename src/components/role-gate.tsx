import type { Role } from "@/lib/contracts/domain";
import { requireRole } from "@/lib/dal/session";

/** Renders children only for the given roles (redirects everyone else). Use inside <Suspense>. */
export async function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  await requireRole(...roles);
  return <>{children}</>;
}
