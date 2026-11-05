import type { MemberAvailability } from "@/lib/server/avails";
import { HOUR, addDaysKey, fmtTime, parseDateKey, startOfDayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

// FR-AV-5: Google busy (grey), manual blocks (coloured), RepresENT sessions (accent).
// Every block also carries a text label, so colour isn't the only signal.

const START_H = 7;
const END_H = 24;
const PX_PER_H = 36;

type Block = { start: number; end: number; kind: "google" | "busy" | "free" | "session"; label: string };

function blocksFor(a: MemberAvailability): Block[] {
  return [
    ...a.googleBusy.map((b) => ({ ...b, kind: "google" as const, label: "Busy (Google)" })),
    ...a.manual.map((m) => ({ start: m.start, end: m.end, kind: m.kind, label: `${m.kind === "busy" ? "Busy" : "Free"}${m.note ? ` · ${m.note}` : ""}` })),
    ...a.ownSessions.map((s) => ({ start: s.start, end: s.end, kind: "session" as const, label: `${s.songTitle} ${s.kind}` })),
  ];
}

const STYLE: Record<Block["kind"], string> = {
  google: "bg-zinc-500/30 text-zinc-200 border-zinc-400/30",
  busy: "bg-rose-500/25 text-rose-100 border-rose-400/50",
  free: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50",
  session: "bg-primary/80 text-primary-foreground border-primary",
};

function dayLabel(key: string) {
  const { year, month, day } = parseDateKey(key);
  return new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function WeekView({ avail, weekKey, tz }: { avail: MemberAvailability; weekKey: string; tz: string }) {
  const all = blocksFor(avail);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekKey, i));

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[720px] grid-cols-[3rem_repeat(7,1fr)] gap-x-1">
          <div />
          {days.map((d) => (
            <div key={d} className="pb-2 text-center text-sm font-medium text-muted-foreground">{dayLabel(d)}</div>
          ))}
          <div className="relative" style={{ height: (END_H - START_H) * PX_PER_H }}>
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <span key={i} className="absolute right-1 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: i * PX_PER_H }}>
                {String(START_H + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayStart = startOfDayKey(d, tz).getTime();
            const viewStart = dayStart + START_H * HOUR;
            const viewEnd = dayStart + END_H * HOUR;
            const dayBlocks = all.filter((b) => b.end > viewStart && b.start < viewEnd);
            return (
              <div key={d} className="relative rounded-lg border bg-card/50" style={{ height: (END_H - START_H) * PX_PER_H }}>
                {Array.from({ length: END_H - START_H }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-border/50" style={{ top: i * PX_PER_H }} />
                ))}
                {dayBlocks.map((b, i) => {
                  const top = ((Math.max(b.start, viewStart) - viewStart) / HOUR) * PX_PER_H;
                  const height = Math.max(14, ((Math.min(b.end, viewEnd) - Math.max(b.start, viewStart)) / HOUR) * PX_PER_H - 2);
                  return (
                    <div
                      key={i}
                      title={`${b.label}: ${fmtTime(new Date(b.start), tz)}–${fmtTime(new Date(b.end), tz)}`}
                      className={cn("absolute overflow-hidden rounded-md border px-1 text-[10px] leading-tight", STYLE[b.kind], b.kind === "session" && "z-10 inset-x-0.5", b.kind === "google" && "inset-x-0.5", (b.kind === "busy" || b.kind === "free") && "right-0.5 left-3")}
                      style={{ top, height }}
                    >
                      {b.label}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: list per day */}
      <div className="flex flex-col gap-2 md:hidden">
        {days.map((d) => {
          const dayStart = startOfDayKey(d, tz).getTime();
          const items = all.filter((b) => b.end > dayStart && b.start < dayStart + 24 * HOUR).sort((a, b) => a.start - b.start);
          return (
            <div key={d} className="rounded-2xl border bg-card p-3">
              <p className="mb-1 font-medium">{dayLabel(d)}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Free all day</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((b, i) => (
                    <li key={i} className={cn("rounded-lg border px-2 py-1 text-sm", STYLE[b.kind])}>
                      {fmtTime(new Date(b.start), tz)}–{fmtTime(new Date(b.end), tz)} · {b.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(["google", "busy", "free", "session"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded border", STYLE[k])} aria-hidden />
            {{ google: "Google busy", busy: "Manual busy", free: "Manual free", session: "RepresENT session" }[k]}
          </span>
        ))}
      </div>
    </>
  );
}
