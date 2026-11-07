import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NavLink, NavLinkBase } from "@/components/layout/nav-link";
import { UserMenu } from "@/components/layout/user-menu";
import { requireActiveUser } from "@/server/auth-guards";
import { getPendingApprovalCount } from "@/server/members/queries";
import { getMyUnreadCount } from "@/server/notifications/queries";
import { MobileTabs } from "@/components/layout/mobile-tabs";
import { ADMIN_NAV, MAIN_NAV } from "@/components/layout/nav-items";
import { NotificationBell } from "@/components/layout/notification-bell";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image src="/logo.svg" alt="" width={32} height={32} priority />
      <span className="font-display text-lg font-bold tracking-tight">
        Repres<span className="text-gradient">ENT</span>
      </span>
    </Link>
  );
}

async function PendingBadge() {
  const count = await getPendingApprovalCount();
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-foreground"
    >
      {count}
    </span>
  );
}

async function AdminNav() {
  const user = await requireActiveUser();
  if (user.role !== "admin") return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
      {ADMIN_NAV.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          badge={
            item.badge ? (
              <Suspense>
                <PendingBadge />
              </Suspense>
            ) : undefined
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

async function HeaderUser() {
  const [user, unread] = await Promise.all([requireActiveUser(), getMyUnreadCount()]);
  return (
    <div className="flex items-center gap-1">
      <NotificationBell initialCount={unread} />
      <UserMenu user={{ id: user.id, name: user.name, email: user.email, image: user.image }} isAdmin={user.role === "admin"} />
    </div>
  );
}

export function AppShell({ children, banners }: { children: ReactNode; banners?: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar/80 p-4 lg:flex">
        <div className="px-2 pt-1">
          <Logo />
        </div>
        <Link href="/songs/new" className={buttonVariants({ className: "glow w-full" })}>
          <HugeiconsIcon icon={Add01Icon} aria-hidden />
          Start a song crew
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <Suspense
              key={item.href}
              fallback={
                <NavLinkBase href={item.href} icon={item.icon}>
                  {item.label}
                </NavLinkBase>
              }
            >
              <NavLink href={item.href} icon={item.icon} exact={item.exact}>
                {item.label}
              </NavLink>
            </Suspense>
          ))}
          <Suspense>
            <AdminNav />
          </Suspense>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 lg:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex-1" />
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <HeaderUser />
          </Suspense>
        </header>
        <main className="pb-safe mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {banners}
          {children}
        </main>
      </div>

      <MobileTabs />
    </div>
  );
}
