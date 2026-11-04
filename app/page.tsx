import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ColorCounters from "@/components/color-counters";
import { getCounts } from "@/lib/data";

async function Counters() {
  const counts = await getCounts();
  return <ColorCounters initialCounts={counts} />;
}

function CountersSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="size-32 rounded-2xl" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background text-foreground">
      <Suspense fallback={<CountersSkeleton />}>
        <Counters />
      </Suspense>
    </main>
  );
}
