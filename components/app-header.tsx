import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NavLink } from "@/components/nav-link";
import { UserMenu } from "@/components/user-menu";
import { requireActiveUser } from "@/lib/dal";
import { getPendingApprovalCount } from "@/lib/data";

async function PendingBadge() {
  const count = await getPendingApprovalCount();
  if (count === 0) return null;
  return (
    <Badge aria-label={`${count} pending approval${count === 1 ? "" : "s"}`}>{count}</Badge>
  );
}

async function HeaderUserArea() {
  const user = await requireActiveUser();
  const isAdmin = user.role === "admin";
  return (
    <>
      <nav className="flex flex-1 items-center gap-1">
        <NavLink href="/" exact>
          Dashboard
        </NavLink>
        {isAdmin ? (
          <NavLink href="/admin">
            Admin
            <Suspense>
              <PendingBadge />
            </Suspense>
          </NavLink>
        ) : null}
      </nav>
      <UserMenu name={user.name} email={user.email} image={user.image} isAdmin={isAdmin} />
    </>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Represent
        </Link>
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-end">
              <Skeleton className="size-8 rounded-full" />
            </div>
          }
        >
          <HeaderUserArea />
        </Suspense>
      </div>
    </header>
  );
}
