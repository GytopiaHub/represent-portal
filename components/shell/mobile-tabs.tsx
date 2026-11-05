"use client";

import Link from "next/link";
import { Suspense } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { useIsActive } from "@/components/nav-link";
import { cn } from "@/lib/utils";
import { MOBILE_TABS } from "./nav-items";

type TabProps = (typeof MOBILE_TABS)[number];

function TabBase({ href, label, icon, active }: TabProps & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
        active && "text-primary",
      )}
    >
      <HugeiconsIcon icon={icon} className="size-6" aria-hidden />
      {label}
    </Link>
  );
}

function Tab(props: TabProps) {
  return <TabBase {...props} active={useIsActive(props.href, props.exact)} />;
}

/** Bottom tab bar, mobile only (NFR-1). */
export function MobileTabs() {
  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {MOBILE_TABS.map((t) => (
        <Suspense key={t.href} fallback={<TabBase {...t} active={false} />}>
          <Tab {...t} />
        </Suspense>
      ))}
    </nav>
  );
}
