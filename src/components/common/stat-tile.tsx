import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border bg-card p-4", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
