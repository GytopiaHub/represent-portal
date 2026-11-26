import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/features/auth/components/auth-card-skeleton";
import { LoginCard } from "@/features/auth/components/login-card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-6">
      <Suspense fallback={<AuthCardSkeleton />}>
        <LoginCard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
