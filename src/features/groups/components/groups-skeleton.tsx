import { Skeleton } from "@/components/ui/skeleton";

export function GroupsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading groups">
      <Skeleton className="h-11 w-full rounded-4xl sm:max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-foreground/10">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-x-2 gap-y-3">
                {Array.from({ length: 5 }, (_, j) => (
                  <div key={j} className="flex flex-col items-center gap-1">
                    <Skeleton className="size-13 rounded-full" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
