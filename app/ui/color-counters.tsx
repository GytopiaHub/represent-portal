"use client";

import { startTransition, useOptimistic, useState } from "react";
import { incrementCount } from "@/app/lib/actions";
import type { Color, Counts } from "@/app/lib/colors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const colors: { name: Color; className: string }[] = [
  { name: "red", className: "bg-red-500 hover:bg-red-600" },
  { name: "blue", className: "bg-blue-500 hover:bg-blue-600" },
  { name: "green", className: "bg-green-500 hover:bg-green-600" },
];

export default function ColorCounters({
  initialCounts,
}: {
  initialCounts: Counts;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [optimisticCounts, addOptimistic] = useOptimistic(
    counts,
    (state, color: Color) => ({ ...state, [color]: state[color] + 1 }),
  );

  function handleClick(color: Color) {
    startTransition(async () => {
      addOptimistic(color); // show +1 immediately
      const saved = await incrementCount(color);
      startTransition(() => {
        setCounts((prev) => ({ ...prev, [color]: saved }));
      });
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {colors.map(({ name, className }) => (
        <Button
          key={name}
          aria-label={`${name}: ${optimisticCounts[name]}`}
          onClick={() => handleClick(name)}
          className={cn(
            "size-32 rounded-2xl text-4xl font-semibold text-white",
            className,
          )}
        >
          {optimisticCounts[name]}
        </Button>
      ))}
    </div>
  );
}
