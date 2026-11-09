import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon, FavouriteIcon, ViewIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import { CoverThumb } from "@/components/common/cover-thumb";
import { fmtCount, fmtDate } from "@/lib/time";

export type CoverCardData = {
  id: string;
  title: string;
  groupName: string;
  videoId: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
};

function Stat({ icon, value, label }: { icon: typeof ViewIcon; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value.toLocaleString()} ${label}`}>
      <HugeiconsIcon icon={icon} className="size-3.5" aria-hidden />
      {fmtCount(value)}
    </span>
  );
}

/**
 * One cover in a catalogue grid (FR-CAT-1). Used by the member catalogue and
 * the public /explore pages; `href` decides where the card leads.
 */
export function CoverCard({ cover: c, href, tz }: { cover: CoverCardData; href: string; tz: string }) {
  return (
    <li className="group flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/50">
      <Link href={href} className="flex flex-col gap-3">
        <CoverThumb src={c.thumbnailUrl} title={c.title} subtitle={c.groupName} />
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-primary">{c.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {c.groupName} · {fmtDate(c.publishedAt, tz)}
          </p>
        </div>
      </Link>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex gap-3">
          <Stat icon={ViewIcon} value={c.views} label="views" />
          <Stat icon={FavouriteIcon} value={c.likes} label="likes" />
          <Stat icon={Comment01Icon} value={c.comments} label="comments" />
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${c.videoId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 hover:text-foreground"
          aria-label={`Watch ${c.title} on YouTube`}
        >
          <HugeiconsIcon icon={YoutubeIcon} className="size-5" aria-hidden />
        </a>
      </div>
    </li>
  );
}

/** Responsive grid wrapper for CoverCards. */
export function CoverGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
