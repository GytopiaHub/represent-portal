import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusScreen } from "@/components/layout/status-screen";
import { UserAvatar } from "@/components/common/user-avatar";
import { requireUser } from "@/server/auth-guards";
import { homePathFor } from "@/lib/access";

export const metadata: Metadata = { title: "Awaiting approval" };

async function PendingDetails() {
  const user = await requireUser();
  if (user.status !== "pending") redirect(homePathFor(user));

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <UserAvatar name={user.name} email={user.email} image={user.image} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <StatusScreen
      title="Awaiting approval"
      description="Thanks for signing up! An admin needs to approve your account before you can use RepresENT. You'll see a notification here once you're in."
      actions={
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Check again
        </Link>
      }
    >
      <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
        <PendingDetails />
      </Suspense>
    </StatusScreen>
  );
}
