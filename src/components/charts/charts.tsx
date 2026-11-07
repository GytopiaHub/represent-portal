"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Single-series charts only (magnitude), so one hue and no legend — the card
// title names the series. Mark colour validated against the dark card surface
// (dataviz validator: lightness band + ≥3:1 contrast).
export const MARK = "#e83e8c";
const AXIS = "oklch(0.74 0.02 285)"; // muted-foreground
const GRID = "oklch(1 0 0 / 8%)";

const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-xl">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">
        {payload[0].value.toLocaleString()} {unit}
      </div>
    </div>
  );
}

export function ColumnChart({ data, unit, height = 220 }: { data: { label: string; count: number }[]; unit: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: number) => fmt.format(v)} />
        <Tooltip cursor={{ fill: "oklch(1 0 0 / 5%)" }} content={<TooltipBox unit={unit} />} />
        <Bar dataKey="count" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, unit }: { data: { name: string; count: number }[]; unit: string }) {
  const height = Math.max(120, data.length * 32 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} />
        <Tooltip cursor={{ fill: "oklch(1 0 0 / 5%)" }} content={<TooltipBox unit={unit} />} />
        <Bar dataKey="count" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fill: AXIS, fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, height = 64 }: { data: { date: string; views: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Tooltip
          cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-xl">
                <div className="text-muted-foreground">{(payload[0].payload as { date: string }).date}</div>
                <div className="font-semibold">{Number(payload[0].value).toLocaleString()} views</div>
              </div>
            ) : null
          }
        />
        <Line type="monotone" dataKey="views" stroke={MARK} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
