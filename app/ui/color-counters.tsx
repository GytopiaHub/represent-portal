"use client";

import { startTransition, useOptimistic, useState } from "react";
import { incrementCount } from "@/app/lib/actions";
import type { Color, Counts } from "@/app/lib/colors";

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
        <button
          key={name}
          type="button"
          aria-label={`${name}: ${optimisticCounts[name]}`}
          onClick={() => handleClick(name)}
          className={`flex h-32 w-32 items-center justify-center rounded-2xl text-4xl font-semibold text-white transition-colors ${className}`}
        >
          {optimisticCounts[name]}
        </button>
      ))}
    </div>
  );
}
