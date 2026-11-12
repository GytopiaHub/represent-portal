"use client";

import { useSyncExternalStore } from "react";

const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
const noop = () => () => {};

// The server can't know the viewer's time zone, so it renders Singapore time
// and the client swaps in local time on hydration.
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noop,
    () => new Date(iso).toLocaleString(undefined, opts),
    () => new Date(iso).toLocaleString("en-SG", { ...opts, timeZone: "Asia/Singapore" }) + " SGT",
  );
  return <time dateTime={iso}>{text}</time>;
}
