import Link from "next/link";
import { Suspense } from "react";
import { Snowflake } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/contracts/domain";
import { getCurrentUser } from "@/lib/dal/session";
import { LiveUpdates } from "./live-updates";
import { NavLinks, NavLinksStatic, type NavItem } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

const NAV: Record<Role, NavItem[]> = {
  HOMEOWNER: [
    { href: "/homeowner", label: "My jobs", exact: true },
    { href: "/homeowner/book", label: "Book clearing" },
    { href: "/homeowner/properties/new", label: "Add property" },
  ],
  CLEANER: [
    { href: "/cleaner", label: "My route", exact: true },
    { href: "/cleaner/shifts", label: "Shifts" },
    { href: "/cleaner/tools", label: "Tools" },
    { href: "/cleaner/earnings", label: "Earnings" },
    { href: "/cleaner/profile", label: "Profile" },
  ],
  CONTROLLER: [
    { href: "/controller", label: "Overview", exact: true },
    { href: "/controller/dispatch", label: "Dispatch" },
    { href: "/controller/windows", label: "Windows" },
    { href: "/controller/jobs", label: "Jobs" },
    { href: "/controller/tools", label: "Tools" },
    { href: "/controller/users", label: "Users" },
  ],
};

/**
 * Shared chrome for the three role apps. The header and navigation are static, so
 * they are part of the prerendered shell; the signed-in user streams in behind Suspense.
 */
export function AppShell({ role, children, wide = false }: { role: Role; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className={`mx-auto flex h-14 items-center gap-3 px-4 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>
          <Link href={NAV[role][0].href} className="flex items-center gap-2 font-semibold text-primary">
            <Snowflake className="size-5" aria-hidden />
            <span>Snowber</span>
            <span className="hidden rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground sm:inline">
              {ROLE_LABEL[role]}
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LiveUpdates className="hidden sm:inline-flex" />
            <Suspense fallback={<span className="h-8 w-24 animate-pulse rounded-md bg-muted" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
        <div className={`mx-auto px-2 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>
          {/* The active link depends on the URL, so it streams in; the fallback is the same nav without highlighting. */}
          <Suspense fallback={<NavLinksStatic items={NAV[role]} />}>
            <NavLinks items={NAV[role]} />
          </Suspense>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/sign-in" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground md:inline">{user.name}</span>
      <SignOutButton />
    </div>
  );
}
