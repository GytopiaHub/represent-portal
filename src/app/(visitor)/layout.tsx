import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EXPLORE_PATH, LOGIN_PATH } from "@/lib/access";

// Public shell for signed-out visitors (R-ROLE-6). No session, notifications
// or user menu here: everything under this group must render for anyone.

const NAV = [
  { href: EXPLORE_PATH, label: "Explore" },
  { href: `${EXPLORE_PATH}/catalogue`, label: "Catalogue" },
];

export default function VisitorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href={EXPLORE_PATH} className="mr-2 flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={32} height={32} priority />
            <span className="font-display text-lg font-bold tracking-tight">
              Repres<span className="text-gradient">ENT</span>
            </span>
          </Link>
          <nav aria-label="Public" className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          {/* Signed-in members hitting /login are sent on to the portal by proxy.ts. */}
          <Link href={LOGIN_PATH} className={buttonVariants({ variant: "outline", className: "hidden sm:inline-flex" })}>
            Member sign in
          </Link>
          <Link href={LOGIN_PATH} className={buttonVariants({ variant: "outline", className: "sm:hidden" })}>
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
