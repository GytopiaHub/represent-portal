import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { YoutubeIcon } from "@hugeicons/core-free-icons";
import { GuestTag } from "@/components/common/chips";
import { StatTile } from "@/components/common/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPLORE_PATH } from "@/lib/access";
import { GROUP_TYPE_LABEL } from "@/lib/labels";
import { DEFAULT_TZ, fmtCount, fmtDate } from "@/lib/time";
import { getPublicSong, type PublicCredit } from "@/server/public/queries";

export async function generateMetadata(props: PageProps<"/explore/songs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const song = await getPublicSong(id);
  return song ? { title: `${song.title} – ${song.groupName}` } : { title: "Cover not found" };
}

function Person({ credit }: { credit: PublicCredit }) {
  const handle = credit.instagram?.replace(/^@/, "");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{credit.name}</span>
      {handle ? (
        <a
          href={`https://www.instagram.com/${encodeURIComponent(handle)}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          @{handle}
        </a>
      ) : null}
      {credit.isGuest ? <GuestTag /> : null}
    </span>
  );
}

function RoleRow({ label, people }: { label: string; people: PublicCredit[] }) {
  if (people.length === 0) return null;
  return (
    <div>
      <dt className="mb-1 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        {people.map((p, i) => (
          <Person key={`${p.name}-${i}`} credit={p} />
        ))}
      </dd>
    </div>
  );
}

/** Public cover page with crew credits (FR-PUB-3). Posted covers only. */
export default async function PublicSongPage(props: PageProps<"/explore/songs/[id]">) {
  const { id } = await props.params;
  const song = await getPublicSong(id);
  if (!song) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href={`${EXPLORE_PATH}/catalogue`} className="text-sm text-muted-foreground hover:text-foreground">
        ← All covers
      </Link>
      <PageHeader
        eyebrow={
          <span>
            {song.groupName} · {GROUP_TYPE_LABEL[song.groupType]} · {fmtDate(song.publishedAt, DEFAULT_TZ)}
          </span>
        }
        title={song.title}
        actions={
          <a
            href={`https://www.youtube.com/watch?v=${song.videoId}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ className: "glow" })}
          >
            <HugeiconsIcon icon={YoutubeIcon} aria-hidden />
            Watch on YouTube
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl border bg-muted">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(song.videoId)}`}
              title={song.videoTitle}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Views" value={fmtCount(song.views)} />
            <StatTile label="Likes" value={fmtCount(song.likes)} />
            <StatTile label="Comments" value={fmtCount(song.comments)} />
          </div>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4">
              {song.dancers.length > 0 ? (
                <div>
                  <dt className="mb-1 text-sm text-muted-foreground">Dancers</dt>
                  <dd className="flex flex-col gap-1">
                    {song.dancers.map((d) => (
                      <span key={d.id} className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-primary">{d.position}</span>
                        <span className="text-muted-foreground">–</span>
                        <Person credit={d} />
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
              <RoleRow label="IC" people={song.ics} />
              <RoleRow label="Videographer" people={song.videographers} />
              <RoleRow label="Editor" people={song.editors} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
