import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Stars } from "@/components/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/dal/session";
import { getMyProfile } from "@/lib/dal/users";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Where your routes start and what equipment you bring." />
      <Suspense fallback={<PageSkeleton rows={1} />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const user = await requireRole("CLEANER");
  const profile = await getMyProfile(user);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {profile.email} · <Stars rating={profile.rating?.average} count={profile.rating?.count} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm phone={profile.phone ?? ""} homeAddress={profile.homeAddress ?? ""} ownsBlower={profile.ownsBlower} />
      </CardContent>
    </Card>
  );
}
