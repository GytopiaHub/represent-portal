import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { StatusChip } from "@/components/common/chips";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { listActiveSongs } from "@/server/songs/queries";
import { fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Songs" };

export default async function SongsPage() {
  const { tz, songs } = await listActiveSongs();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Song crews"
        description="Covers in progress. Jump into one that's recruiting, or start your own."
        actions={
          <Link href="/songs/new" className={buttonVariants({ className: "glow" })}>
            <HugeiconsIcon icon={Add01Icon} aria-hidden />
            Start a song crew
          </Link>
        }
      />
      {songs.length === 0 ? (
        <EmptyState title="No crews in progress">Start one — you&apos;ll be its IC.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {songs.map((s) => (
            <li key={s.id}>
              <Link href={`/songs/${s.id}`} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{s.groupName}</p>
                    <p className="truncate text-lg font-bold">{s.title}</p>
                  </div>
                  <StatusChip status={s.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{s.crewSize} in crew</span>
                  {s.openSlots > 0 ? <span className="text-cyan-300">{s.openSlots} unfilled position{s.openSlots === 1 ? "" : "s"}</span> : null}
                  {s.targetPostDate ? <span>Target {fmtDate(s.targetPostDate, tz)}</span> : null}
                  {s.mine ? <span className="text-primary">You&apos;re in this</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
