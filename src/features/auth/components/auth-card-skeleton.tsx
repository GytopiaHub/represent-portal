import { Skeleton } from "@/components/ui/skeleton";

export function AuthCardSkeleton() {
  return (
    <div
      className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl px-6 py-6 ring-1 ring-foreground/10"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-11 w-full rounded-4xl" />
    </div>
  );
}
