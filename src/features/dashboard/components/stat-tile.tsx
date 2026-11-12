import { Card } from "@/components/ui/card";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm" className="gap-1 px-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
