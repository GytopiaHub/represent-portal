"use client";

import { useState } from "react";

const colors = [
  { name: "red", className: "bg-red-500 hover:bg-red-600" },
  { name: "blue", className: "bg-blue-500 hover:bg-blue-600" },
  { name: "green", className: "bg-green-500 hover:bg-green-600" },
] as const;

type Color = (typeof colors)[number]["name"];

export default function ColorCounters() {
  const [counts, setCounts] = useState<Record<Color, number>>({
    red: 0,
    blue: 0,
    green: 0,
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {colors.map(({ name, className }) => (
        <button
          key={name}
          type="button"
          aria-label={`${name}: ${counts[name]}`}
          onClick={() =>
            setCounts((prev) => ({ ...prev, [name]: prev[name] + 1 }))
          }
          className={`flex h-32 w-32 items-center justify-center rounded-2xl text-4xl font-semibold text-white transition-colors ${className}`}
        >
          {counts[name]}
        </button>
      ))}
    </div>
  );
}
