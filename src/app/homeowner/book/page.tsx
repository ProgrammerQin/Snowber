import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { LOT_SIZE_LABEL } from "@/lib/contracts/domain";
import { listMyProperties } from "@/lib/dal/properties";
import { requireRole } from "@/lib/dal/session";
import { listBookableWindows } from "@/lib/dal/windows";
import { formatMultiplier, formatWindow } from "@/lib/format";
import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = { title: "Book clearing" };

export default function BookPage({ searchParams }: PageProps<"/homeowner/book">) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Book snow clearing" description="Three quick steps. You'll see the exact price before you confirm." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Booking searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Booking({ searchParams }: { searchParams: PageProps<"/homeowner/book">["searchParams"] }) {
  const user = await requireRole("HOMEOWNER");
  const [{ property }, properties, windows] = await Promise.all([searchParams, listMyProperties(user), listBookableWindows(user)]);

  if (properties.length === 0) {
    return (
      <EmptyState title="Add a property first">
        <Button asChild className="mt-3">
          <Link href="/homeowner/properties/new">Add property</Link>
        </Button>
      </EmptyState>
    );
  }
  if (windows.length === 0) {
    return (
      <EmptyState title="No time windows are open right now">
        The controller opens windows when snow is in the forecast. You&apos;ll be able to book here as soon as they do.
      </EmptyState>
    );
  }

  return (
    <BookingWizard
      initialPropertyId={typeof property === "string" && properties.some((p) => p.id === property) ? property : properties[0].id}
      properties={properties.map((p) => ({
        id: p.id,
        title: p.label ?? p.address,
        subtitle: `${p.label ? `${p.address} · ` : ""}${LOT_SIZE_LABEL[p.lotSize]}`,
        hasSidewalk: p.hasSidewalk,
      }))}
      windows={windows.map((w) => ({
        id: w.id,
        label: w.label ?? formatWindow(w.startsAt, w.endsAt),
        when: formatWindow(w.startsAt, w.endsAt),
        multiplier: w.multiplierBps === 10000 ? null : formatMultiplier(w.multiplierBps),
      }))}
    />
  );
}
