"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; exact?: boolean };

function isActive(item: NavItem, pathname: string | null) {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Nav({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Highlights the current section. Reads the URL, so render it inside <Suspense>. */
export function NavLinks({ items }: { items: NavItem[] }) {
  return <Nav items={items} pathname={usePathname()} />;
}

/** Same links without highlighting; used as the prerendered fallback. */
export function NavLinksStatic({ items }: { items: NavItem[] }) {
  return <Nav items={items} pathname={null} />;
}
