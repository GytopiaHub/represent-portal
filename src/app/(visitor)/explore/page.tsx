import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { YoutubeIcon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/layout/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { CoverCard, CoverGrid } from "@/features/catalogue/components/cover-card";
import { EXPLORE_PATH } from "@/lib/access";
import { DEFAULT_TZ, fmtCount } from "@/lib/time";
import { getPublicOverview } from "@/server/public/queries";

export const metadata: Metadata = {
  title: "Explore",
  description: "RepresENT's K-pop dance covers: our channel, most popular videos and full catalogue.",
};

/** Public landing page (FR-PUB-1, FR-PUB-2). */
export default async function ExplorePage() {
  const { channel, totals, topGroups, popular } = await getPublicOverview();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6 rounded-3xl border bg-card/60 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-sm text-muted-foreground">{channel.handle}</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Repres<span className="text-gradient">ENT</span>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{channel.description}</p>
          </div>
          <a href={channel.url} target="_blank" rel="noreferrer" className={buttonVariants({ className: "glow shrink-0" })}>
            <HugeiconsIcon icon={YoutubeIcon} aria-hidden />
            Visit our channel
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Subscribers" value={fmtCount(channel.subscriberCount)} />
          <StatTile label="Videos" value={fmtCount(channel.videoCount)} />
          <StatTile label="Channel views" value={fmtCount(channel.viewCount)} />
          <StatTile label="Dance covers" value={fmtCount(totals.covers)} hint={`${fmtCount(totals.views)} views on covers`} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          action={
            <Link href={`${EXPLORE_PATH}/catalogue?sort=views`} className="text-sm text-primary hover:underline">
              See all covers
            </Link>
          }
        >
          Most popular covers
        </SectionTitle>
        {popular.length === 0 ? (
          <EmptyState title="No covers yet">Check back soon.</EmptyState>
        ) : (
          <CoverGrid>
            {popular.map((c) => (
              <CoverCard key={c.id} cover={c} href={`${EXPLORE_PATH}/songs/${c.id}`} tz={DEFAULT_TZ} />
            ))}
          </CoverGrid>
        )}
      </section>

      {topGroups.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionTitle>Groups we cover most</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {topGroups.map((g) => (
              <li key={g.name}>
                <Link
                  href={`${EXPLORE_PATH}/catalogue?q=${encodeURIComponent(g.name)}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:border-primary/50"
                >
                  {g.name}
                  <span className="text-muted-foreground">×{g.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
