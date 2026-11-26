import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/features/auth/components/auth-card-skeleton";
import { ProfileCard } from "@/features/auth/components/profile-card";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Suspense fallback={<AuthCardSkeleton />}>
        <ProfileCard />
      </Suspense>
    </main>
  );
}
