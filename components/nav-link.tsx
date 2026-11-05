"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";

// usePathname() is runtime data under Cache Components, so hook-driven links
// must sit inside <Suspense>. Each link has a presentational base (used as
// the fallback, no active state) and a hook-driven version.

export function useIsActive(href: string, exact = false) {
  const pathname = usePathname();
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type NavLinkProps = {
  href: string;
  children: ReactNode;
  exact?: boolean;
  icon?: IconSvgElement;
  badge?: ReactNode;
};

export function NavLinkBase({ href, children, icon, badge, active = false }: NavLinkProps & { active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-sidebar-accent text-foreground",
      )}
    >
      {icon ? <HugeiconsIcon icon={icon} className={cn("size-5", active && "text-primary")} aria-hidden /> : null}
      <span className="flex-1">{children}</span>
      {badge}
    </Link>
  );
}

/** Sidebar link with active state. Render inside <Suspense>. */
export function NavLink(props: NavLinkProps) {
  const active = useIsActive(props.href, props.exact);
  return <NavLinkBase {...props} active={active} />;
}

/** Pill-style link for in-page tabs (song tabs, year picker, admin sub-nav). */
export function TabLink({ href, children, active }: { href: string; children: ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-primary text-primary-foreground hover:text-primary-foreground",
      )}
    >
      {children}
    </Link>
  );
}
