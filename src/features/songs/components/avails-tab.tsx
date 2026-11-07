import Link from "next/link";
import { Heatmap } from "@/features/availability/components/heatmap";
import { SectionTitle } from "@/components/layout/page-header";
import { TabLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { buildHeatmap, getAvailability, suggestSlots } from "@/server/availability/engine";
import { getAvailsMemberIds } from "@/server/crew/queries";
import type { SongDetail } from "@/server/songs/queries";
import { addDaysKey, fmtDateTime, fmtTime, startOfDayKey, toLocalInputValue, weekStartKey } from "@/lib/time";

export async function AvailsTab({
  song,
  params,
}: {
  song: SongDetail;
  params: { week?: string; members?: string; dur?: string };
}) {
  const everyone = params.members === "all";
  const week = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : weekStartKey(new Date(), song.tz);
  const from = startOfDayKey(week, song.tz);
  const to = startOfDayKey(addDaysKey(week, 7), song.tz);
  const duration = [60, 90, 120, 180, 240].includes(Number(params.dur)) ? Number(params.dur) : 120;

  // Crew members, or any active member while recruiting (FR-AV-6).
  const ids = await getAvailsMemberIds(song.id, everyone);

  const avails = await getAvailability(ids, from, to);
  const [days, slots] = await Promise.all([
    buildHeatmap(avails, week),
    Promise.resolve(suggestSlots(avails, from, to, duration)),
  ]);
  const base = `/songs/${song.id}?tab=avails${everyone ? "&members=all" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <TabLink href={`/songs/${song.id}?tab=avails&week=${week}`} active={!everyone}>
          Crew ({new Set(song.crew.filter((c) => c.holder.kind === "member").map((c) => (c.holder.kind === "member" ? c.holder.userId : ""))).size})
        </TabLink>
        <TabLink href={`/songs/${song.id}?tab=avails&members=all&week=${week}`} active={everyone}>
          All members
        </TabLink>
        <div className="flex-1" />
        <Link href={`${base}&week=${addDaysKey(week, -7)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-muted" scroll={false}>
          ← Prev week
        </Link>
        <Link href={`${base}&week=${addDaysKey(week, 7)}`} className="rounded-full px-3 py-1.5 text-sm hover:bg-muted" scroll={false}>
          Next week →
        </Link>
      </div>

      <Heatmap days={days} total={avails.size} tz={song.tz} />

      <section className="flex flex-col gap-3">
        <SectionTitle
          action={
            <form className="flex items-center gap-2">
              <input type="hidden" name="tab" value="avails" />
              <input type="hidden" name="week" value={week} />
              {everyone ? <input type="hidden" name="members" value="all" /> : null}
              <NativeSelect name="dur" defaultValue={String(duration)} size="sm" aria-label="Duration">
                {[60, 90, 120, 180, 240].map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {m / 60} h
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button type="submit" size="sm" variant="outline">
                Update
              </Button>
            </form>
          }
        >
          Suggested slots
        </SectionTitle>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No free slots this week for that duration.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {slots.map((s, i) => (
              <li key={s.start} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span className="font-medium">
                  {fmtDateTime(new Date(s.start), song.tz)} – {fmtTime(new Date(s.end), song.tz)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {s.free.length}/{s.total} free
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{s.free.join(", ")}</span>
                {song.canEdit ? (
                  <Link
                    href={`/songs/${song.id}?tab=schedule&start=${toLocalInputValue(new Date(s.start), song.tz)}#new-session`}
                    className="text-sm text-primary hover:underline"
                  >
                    Schedule →
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
