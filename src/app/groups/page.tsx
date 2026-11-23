import type { Metadata } from "next";
import { Suspense } from "react";
import { Groups } from "@/features/groups/components/groups";
import { GroupsSkeleton } from "@/features/groups/components/groups-skeleton";

export const metadata: Metadata = { title: "Groups" };

export default function GroupsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
      <Suspense fallback={<GroupsSkeleton />}>
        <Groups />
      </Suspense>
    </main>
  );
}
