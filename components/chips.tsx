import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, CheckmarkCircle02Icon, HelpCircleIcon } from "@hugeicons/core-free-icons";
import type { CrewRole, SongStatus } from "@/db/schema";
import { CREW_ROLE_LABEL, SONG_STATUS_CLASS, SONG_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function StatusChip({ status, className }: { status: SongStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        SONG_STATUS_CLASS[status],
        className,
      )}
    >
      {SONG_STATUS_LABEL[status]}
    </span>
  );
}

export function RoleChip({ role }: { role: CrewRole }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
      {CREW_ROLE_LABEL[role]}
    </span>
  );
}

const FLAG = {
  available: { icon: CheckmarkCircle02Icon, label: "Available", cls: "text-emerald-400" },
  unavailable: { icon: Cancel01Icon, label: "Unavailable", cls: "text-rose-400" },
  unknown: { icon: HelpCircleIcon, label: "Unknown", cls: "text-muted-foreground" },
} as const;

/** Availability flag — icon + label, never colour alone (NFR-3). */
export function AvailFlag({ flag }: { flag: keyof typeof FLAG }) {
  const f = FLAG[flag];
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", f.cls)}>
      <HugeiconsIcon icon={f.icon} className="size-4" aria-hidden />
      {f.label}
    </span>
  );
}

export function GuestTag() {
  return (
    <span className="rounded-full border border-dashed px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      Guest
    </span>
  );
}
