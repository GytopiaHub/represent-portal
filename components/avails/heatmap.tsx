import type { HeatDay } from "@/lib/server/avails";
import { fmtTime, parseDateKey } from "@/lib/time";

// FR-AV-6: each cell shows how many people are free; hover/tap lists who's busy.
// Sequential encoding = one hue (pink), light → strong with the free share.
// The count is always printed, so colour is never the only signal.

function dayLabel(key: string) {
  const { year, month, day } = parseDateKey(key);
  return new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function cellStyle(free: number, total: number) {
  if (total === 0) return {};
  const share = free / total;
  return { backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(8 + share * 72)}%, var(--card))` };
}

function who(cell: HeatDay["cells"][number]) {
  const parts = [];
  if (cell.busy.length) parts.push(`Busy: ${cell.busy.join(", ")}`);
  if (cell.unknown.length) parts.push(`Unknown: ${cell.unknown.join(", ")}`);
  if (cell.free.length) parts.push(`Free: ${cell.free.join(", ")}`);
  return parts.join("\n");
}

export function Heatmap({ days, total, tz }: { days: HeatDay[]; total: number; tz: string }) {
  if (days.length === 0) return null;
  const rows = days[0].cells.length;

  return (
    <>
      {/* Desktop/tablet grid */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">Number of crew members free per hour</caption>
          <thead>
            <tr>
              <th className="w-14" />
              {days.map((d) => (
                <th key={d.key} scope="col" className="px-1 pb-1 font-medium text-muted-foreground">
                  {dayLabel(d.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th scope="row" className="pr-2 text-right font-normal text-muted-foreground">
                  {fmtTime(new Date(days[0].cells[r].start), tz)}
                </th>
                {days.map((d) => {
                  const c = d.cells[r];
                  const past = c.end < Date.now();
                  return (
                    <td
                      key={d.key}
                      title={who(c)}
                      tabIndex={0}
                      aria-label={`${dayLabel(d.key)} ${fmtTime(new Date(c.start), tz)}: ${c.free.length} of ${total} free. ${who(c)}`}
                      className={`h-8 min-w-12 rounded-md text-center font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring ${past ? "opacity-40" : ""}`}
                      style={cellStyle(c.free.length, total)}
                    >
                      {c.free.length}
                      {c.unknown.length ? <span className="font-normal text-muted-foreground">+{c.unknown.length}?</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Number = people free that hour (out of {total}). &quot;+n?&quot; = no calendar connected. Hover or focus a cell to see who&apos;s busy.
        </p>
      </div>

      {/* Mobile: day-by-day list (FR-AV-6) */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.map((d) => {
          const best = [...d.cells].filter((c) => c.end > Date.now()).sort((a, b) => b.free.length - a.free.length || a.start - b.start).slice(0, 3);
          return (
            <details key={d.key} className="rounded-2xl border bg-card p-3">
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                {dayLabel(d.key)}
                <span className="text-sm text-muted-foreground">
                  best: {best[0] ? `${best[0].free.length}/${total} at ${fmtTime(new Date(best[0].start), tz)}` : "—"}
                </span>
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {d.cells.map((c) => (
                  <li key={c.start} className="flex gap-3">
                    <span className="w-16 shrink-0 text-muted-foreground">{fmtTime(new Date(c.start), tz)}</span>
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{c.free.length}/{total}</span>
                    <span className="min-w-0 text-muted-foreground">{c.busy.length ? `busy: ${c.busy.join(", ")}` : "everyone free"}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </>
  );
}
