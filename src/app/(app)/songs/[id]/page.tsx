import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/common/action-button";
import { StatusChip } from "@/components/common/chips";
import { TabLink } from "@/components/layout/nav-link";
import { PageHeader } from "@/components/layout/page-header";
import { AvailsTab } from "@/features/songs/components/avails-tab";
import { CrewTab } from "@/features/songs/components/crew-tab";
import { OverviewTab } from "@/features/songs/components/overview-tab";
import { ScheduleTab } from "@/features/schedule/components/schedule-tab";
import { VideoTab } from "@/features/songs/components/video-tab";
import { Card, CardContent } from "@/components/ui/card";
import { respondToInvite } from "@/server/crew/actions";
import { CREW_ROLE_LABEL, GROUP_TYPE_LABEL } from "@/lib/labels";
import { getSongDetail } from "@/server/songs/queries";

export const metadata: Metadata = { title: "Song" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "crew", label: "Crew" },
  { key: "schedule", label: "Schedule" },
  { key: "avails", label: "Avails" },
  { key: "video", label: "Video" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const z = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function SongPage(props: PageProps<"/songs/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const song = await getSongDetail(id);
  if (!song) notFound();
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "overview";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <span>
            {song.group.name} · {GROUP_TYPE_LABEL[song.group.groupType]}
          </span>
        }
        title={
          <span className={song.status === "cancelled" ? "text-muted-foreground line-through" : undefined}>{song.title}</span>
        }
        actions={<StatusChip status={song.status} className="h-8 px-3 text-sm" />}
      />

      {song.myInvites.map((inv) => (
        <Card key={inv.id} className="glow border-primary/50">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1">
              You&apos;re invited as <strong>{CREW_ROLE_LABEL[inv.role]}</strong>
              {inv.positionId ? (
                <>
                  {" "}
                  for <strong>{song.positions.find((p) => p.id === inv.positionId)?.label}</strong>
                </>
              ) : null}
              .
            </p>
            <div className="flex gap-2">
              <ActionButton action={respondToInvite.bind(null, inv.id, true)} variant="default">
                Accept
              </ActionButton>
              <ActionButton action={respondToInvite.bind(null, inv.id, false)} variant="ghost">
                Decline
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      ))}

      <nav aria-label="Song sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <TabLink key={t.key} href={`/songs/${song.id}?tab=${t.key}`} active={tab === t.key}>
            {t.label}
          </TabLink>
        ))}
      </nav>

      {tab === "overview" ? <OverviewTab song={song} /> : null}
      {tab === "crew" ? <CrewTab song={song} /> : null}
      {tab === "schedule" ? <ScheduleTab song={song} startParam={z(sp.start)} /> : null}
      {tab === "avails" ? <AvailsTab song={song} params={{ week: z(sp.week), members: z(sp.members), dur: z(sp.dur) }} /> : null}
      {tab === "video" ? <VideoTab song={song} /> : null}
    </div>
  );
}
