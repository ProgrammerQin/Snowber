import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page";
import { ROLE_HOME } from "@/lib/contracts/domain";
import { getCurrentUser } from "@/lib/dal/session";

// After sign-in, send each user to their own app.
export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<PageSkeleton rows={1} />}>
        <RedirectByRole />
      </Suspense>
    </div>
  );
}

async function RedirectByRole(): Promise<null> {
  const user = await getCurrentUser();
  redirect(user ? ROLE_HOME[user.role] : "/sign-in");
}
