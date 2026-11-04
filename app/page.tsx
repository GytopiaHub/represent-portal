import { Suspense } from "react";
import ColorCounters from "./ui/color-counters";
import { getCounts } from "./lib/data";

async function Counters() {
  const counts = await getCounts();
  return <ColorCounters initialCounts={counts} />;
}

function CountersSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 w-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Suspense fallback={<CountersSkeleton />}>
        <Counters />
      </Suspense>
    </main>
  );
}
