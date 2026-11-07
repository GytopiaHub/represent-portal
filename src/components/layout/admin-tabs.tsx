"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TabLink } from "@/components/layout/nav-link";
import { ADMIN_NAV } from "@/components/layout/nav-items";

function Tabs({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {ADMIN_NAV.map((i) => (
        <TabLink key={i.href} href={i.href} active={pathname.startsWith(i.href)}>
          {i.label}
        </TabLink>
      ))}
    </nav>
  );
}

function ActiveTabs() {
  return <Tabs pathname={usePathname()} />;
}

export function AdminTabs() {
  return (
    <Suspense fallback={<Tabs pathname="" />}>
      <ActiveTabs />
    </Suspense>
  );
}
