import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Month = { key: string; label: string; count: number };

const W = 520;
const H = 180;
const PAD_LEFT = 24;
const PAD_BOTTOM = 22;
const PAD_TOP = 16;

function niceTicks(max: number) {
  const step = Math.max(1, Math.ceil(max / 2));
  return [0, step, step * 2];
}

// Server-rendered SVG: one series, so no legend. --chart-1 sits below 3:1
// on the card, so the peak is labelled, each column has a tooltip, and the
// table view carries every value.
export function UploadsChart({ months }: { months: Month[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const step = (W - PAD_LEFT) / months.length;
  const bw = Math.min(24, step * 0.55);
  const peak = months.reduce((best, m, i) => (m.count > months[best].count ? i : best), 0);
  const y = (v: number) => H - PAD_BOTTOM - (v / top) * (H - PAD_BOTTOM - PAD_TOP);
  const total = months.reduce((s, m) => s + m.count, 0);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Uploads per month</CardTitle>
        <CardDescription>
          {total} in the last {months.length} months
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Uploads per month: ${months.map((m) => `${m.label} ${m.count}`).join(", ")}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" />
              <text x={PAD_LEFT - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const x = PAD_LEFT + i * step + (step - bw) / 2;
            const barTop = y(m.count);
            const r = Math.min(4, (H - PAD_BOTTOM - barTop) / 2);
            return (
              <g key={m.key}>
                <title>{`${m.label}: ${m.count} upload${m.count === 1 ? "" : "s"}`}</title>
                {/* Hit target is the whole column slot, wider than the bar. */}
                <rect x={PAD_LEFT + i * step} y={PAD_TOP} width={step} height={H - PAD_TOP} fill="transparent" />
                {m.count > 0 && (
                  <path
                    d={`M${x},${H - PAD_BOTTOM}V${barTop + r}q0,-${r} ${r},-${r}h${bw - 2 * r}q${r},0 ${r},${r}V${H - PAD_BOTTOM}Z`}
                    className="fill-chart-1"
                  />
                )}
                {i === peak && m.count > 0 && (
                  <text x={x + bw / 2} y={barTop - 5} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
                    {m.count}
                  </text>
                )}
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground underline underline-offset-4">Show as table</summary>
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-left font-medium">Month</th>
                <th className="py-1 text-right font-medium">Uploads</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key} className="border-t border-border">
                  <td className="py-1">{m.key}</td>
                  <td className="py-1 text-right tabular-nums">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </CardContent>
    </Card>
  );
}
