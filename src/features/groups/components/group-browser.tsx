"use client";

import Image from "next/image";
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
    () => (q ? groups.filter((g) => fold(g.name).includes(q) || g.members.some((m) => fold(m.name).includes(q))) : groups),
    [groups, q],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          placeholder="Search groups or members"
          aria-label="Search groups or members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 sm:max-w-sm"
        />
        {q && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {shown.length} of {plural(groups.length, "group")}
          </p>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No groups or members match &quot;{query.trim()}&quot;.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => (
            <Card key={g.slug} className="gap-0 py-0">
              <section aria-labelledby={`group-${g.slug}`}>
                <GroupPhoto group={g} />
                <div className="flex flex-col gap-3 p-4">
                  <h2 id={`group-${g.slug}`} className="flex items-baseline gap-2 text-base font-semibold">
                    <Highlight text={g.name} q={q} />
                    <span className="text-xs font-normal text-muted-foreground">{plural(g.members.length, "member")}</span>
                  </h2>
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-x-2 gap-y-3">
                    {g.members.map((m) => (
                      <li key={m.name} className="flex flex-col items-center gap-1 text-center">
                        <Photo
                          src={m.image}
                          alt={`${m.name} of ${g.name}`}
                          fallback={m.name}
                          className="size-13 rounded-full"
                          sizes="52px"
                        />
                        <span className="text-xs leading-tight font-medium">
                          <Highlight text={m.name} q={q} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Photos from the{" "}
        <a href="https://kpop.fandom.com/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
          K-pop Wiki
        </a>{" "}
        on Fandom.
      </p>
    </div>
  );
}

// Every card uses the same 4:3 frame so rows line up. Landscape photos fill it;
// portrait ones show whole, over a blurred copy of themselves so the sides
// take the photo's own colours instead of grey bars.
function GroupPhoto({ group: g }: { group: Group }) {
  const portrait = !!g.image && g.image.height > g.image.width;
  return (
    <Photo
      src={g.image?.src ?? null}
      alt={g.name}
      className="aspect-4/3 w-full text-3xl"
      imgClassName={portrait ? "object-contain" : undefined}
      backdrop={portrait}
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
    />
  );
}

// Shows the initial when there is no photo or it fails to load, so a missing
// wiki page or a Fandom outage never leaves a broken image.
function Photo({
  src,
  alt,
  fallback = alt,
  className,
  imgClassName = "object-cover object-top",
  backdrop = false,
  sizes,
}: {
  src: string | null;
  alt: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
  backdrop?: boolean;
  sizes: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <span
        aria-hidden="true"
        className={cn("flex shrink-0 items-center justify-center bg-muted font-semibold text-muted-foreground", className)}
      >
        {initial(fallback)}
      </span>
    );
  }
  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-muted", className)}>
      {/* Fandom already serves resized WebP, so skip the Next optimizer. The
          backdrop reuses the same file, so it costs no extra download. */}
      {backdrop && (
        <Image src={src} alt="" aria-hidden fill unoptimized sizes={sizes} className="scale-125 object-cover blur-2xl" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes={sizes}
        className={imgClassName}
        onError={() => setFailed(src)}
      />
    </span>
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
