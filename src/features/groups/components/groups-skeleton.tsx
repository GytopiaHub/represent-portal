import { Skeleton } from "@/components/ui/skeleton";

export function GroupsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading groups">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl last:col-span-2 sm:last:col-span-1" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-4xl sm:max-w-sm" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }, (_, j) => (
              <Skeleton key={j} className="h-28 w-28 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
