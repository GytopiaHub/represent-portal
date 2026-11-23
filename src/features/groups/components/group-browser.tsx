"use client";

import { useMemo, useState } from "react";
import type { Group } from "@/server/groups/queries";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Strips accents so "rose" finds "Rosé". For precomposed text this keeps one
// character per original character, so Highlight can reuse the match index.
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function GroupBrowser({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const q = fold(query.trim());

  const shown = useMemo(
    () => (q ? groups.filter((g) => fold(g.name).includes(q) || g.members.some((m) => fold(m).includes(q))) : groups),
    [groups, q],
  );
  const members = groups.reduce((n, g) => n + g.members.length, 0);
  const largest = groups.reduce((a, b) => (b.members.length > a.members.length ? b : a));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Groups" value={groups.length.toLocaleString("en")} />
        <Stat label="Members" value={members.toLocaleString("en")} />
        <Stat
          label="Largest"
          value={largest.name}
          hint={plural(largest.members.length, "member")}
          className="col-span-2 sm:col-span-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          placeholder="Search groups or members"
          aria-label="Search groups or members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 sm:max-w-sm"
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {q ? `${shown.length} of ${plural(groups.length, "group")}` : "Members are in official line order."}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No groups or members match &quot;{query.trim()}&quot;.</p>
      ) : (
        shown.map((g) => (
          <section key={g.slug} aria-labelledby={`group-${g.slug}`} className="flex flex-col gap-3">
            <h2 id={`group-${g.slug}`} className="flex items-baseline gap-2 text-base font-semibold">
              <Highlight text={g.name} q={q} />
              <span className="text-xs font-normal text-muted-foreground">{plural(g.members.length, "member")}</span>
            </h2>
            {/* Scrolls sideways on phones so a 13-member group doesn't push the rest down; wraps on desktop. */}
            <ol className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:scroll-px-0">
              {g.members.map((m, i) => (
                <li
                  key={m}
                  className="flex w-28 shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
                  >
                    {initial(m)}
                  </span>
                  <span className="text-xs text-muted-foreground">No. {i + 1}</span>
                  <span className="text-sm leading-tight font-medium">
                    <Highlight text={m} q={q} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <Card size="sm" className={cn("gap-1 px-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? fold(text).indexOf(q) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-foreground/20 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

// Skips leading symbols so "&TEAM"-style names still get a letter.
function initial(name: string) {
  const c = /[\p{L}\p{N}]/u.exec(name)?.[0] ?? "?";
  return c.toUpperCase();
}
