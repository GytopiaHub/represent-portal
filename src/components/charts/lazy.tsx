"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts is lazy-loaded so it stays out of the first-load bundle (NFR-2).
const loading = () => <Skeleton className="h-full min-h-16 w-full rounded-xl" />;

export const ColumnChart = dynamic(() => import("@/components/charts/charts").then((m) => m.ColumnChart), { ssr: false, loading });
export const HBarChart = dynamic(() => import("@/components/charts/charts").then((m) => m.HBarChart), { ssr: false, loading });
export const Sparkline = dynamic(() => import("@/components/charts/charts").then((m) => m.Sparkline), { ssr: false, loading });
