import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";

export const metadata: Metadata = { title: "Channel dashboard" };

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Channel dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
