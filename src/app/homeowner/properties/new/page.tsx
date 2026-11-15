import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/page";
import { RoleGate } from "@/components/role-gate";
import { PropertyForm } from "./property-form";

export const metadata: Metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a property" description="We use the address to route cleaners and the lot size to price the job." />
      <Suspense fallback={<PageSkeleton rows={1} />}>
        <RoleGate roles={["HOMEOWNER"]}>
          <PropertyForm />
        </RoleGate>
      </Suspense>
    </div>
  );
}
