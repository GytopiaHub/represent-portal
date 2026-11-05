import Link from "next/link";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createSession } from "@/lib/actions/sessions";
import { BOOKING_LABEL, SESSION_KIND_LABEL } from "@/lib/labels";
import { getSongSessions, type SongDetail } from "@/lib/queries/songs";
import { getSettings } from "@/lib/server/settings";
import { fmtRange, parseLocalDateTime, toLocalInputValue } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SessionForm } from "./session-form";

export async function ScheduleTab({ song, startParam }: { song: SongDetail; startParam?: string }) {
  const [sessions, settings] = await Promise.all([getSongSessions(song.id), getSettings()]);
  const now = Date.now();
  const upcoming = sessions.filter((s) => s.endsAt.getTime() >= now);
  const past = sessions.filter((s) => s.endsAt.getTime() < now);

  // Prefill from a suggested slot (?start=...) or tomorrow 7:30pm.
  const suggested = startParam ? parseLocalDateTime(startParam, song.tz) : null;
  const start = suggested ?? new Date(Math.ceil((now + 86_400_000) / 3_600_000) * 3_600_000);
  const startLocal = suggested ? startParam!.slice(0, 16) : toLocalInputValue(start, song.tz).slice(0, 11) + "19:30";
  const endLocal = toLocalInputValue(new Date((parseLocalDateTime(startLocal, song.tz) ?? start).getTime() + settings.defaultPracticeMinutes * 60_000), song.tz);

  const List = ({ items }: { items: typeof sessions }) => (
    <ul className="flex flex-col gap-2">
      {items.map((s) => (
        <li key={s.id}>
          <Link
            href={`/songs/${song.id}/sessions/${s.id}`}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/50",
              s.status === "cancelled" && "opacity-60",
            )}
          >
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s.kind === "filming" ? "bg-amber-400/15 text-amber-300" : "bg-violet-400/15 text-violet-300")}>
              {SESSION_KIND_LABEL[s.kind]}
            </span>
            <span className={cn("font-medium", s.status === "cancelled" && "line-through")}>{fmtRange(s.startsAt, s.endsAt, song.tz)}</span>
            {s.status === "cancelled" ? <span className="text-sm text-rose-400">Cancelled</span> : null}
            <span className="flex-1 truncate text-sm text-muted-foreground">{s.locationText}</span>
            <span className="text-sm text-muted-foreground">
              {s.going} going · {s.notGoing} can&apos;t
              {s.kind === "practice" && s.bookingStatus !== "not_needed" ? ` · ${BOOKING_LABEL[s.bookingStatus]}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-3">
          <SectionTitle>Upcoming</SectionTitle>
          {upcoming.length === 0 ? <EmptyState title="Nothing scheduled yet" /> : <List items={upcoming} />}
        </section>
        {past.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>Past</SectionTitle>
            <List items={past.reverse()} />
          </section>
        ) : null}
      </div>
      {song.canEdit ? (
        <aside>
          <Card id="new-session">
            <CardContent className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold">Schedule a session</h3>
                <p className="text-sm text-muted-foreground">
                  Adds an event to every crew member&apos;s Google Calendar. Need a time?{" "}
                  <Link href={`/songs/${song.id}?tab=avails`} className="underline">See suggested slots</Link>.
                </p>
              </div>
              <SessionForm
                action={createSession.bind(null, song.id)}
                defaults={{ kind: "practice", startsAt: startLocal, endsAt: endLocal }}
                durations={{ practice: settings.defaultPracticeMinutes, filming: settings.defaultFilmingMinutes }}
                submitLabel="Create session"
              />
            </CardContent>
          </Card>
        </aside>
      ) : null}
    </div>
  );
}
