"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border">
      <nav aria-label="Main" className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-2">
        <Link href="/" className="mr-2 flex min-h-11 items-center" aria-label="RepresENT home">
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
        </Link>
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-muted text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
