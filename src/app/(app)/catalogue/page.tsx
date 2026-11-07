import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon, FavouriteIcon, ViewIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CoverThumb } from "@/components/common/cover-thumb";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { GROUP_TYPES, GROUP_TYPE_LABEL } from "@/lib/labels";
import { getCatalogueFilterOptions, listCatalogue, parseCatalogueParams } from "@/server/catalogue/queries";
import { fmtCount, fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Catalogue" };

function Stat({ icon, value, label }: { icon: typeof ViewIcon; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value.toLocaleString()} ${label}`}>
      <HugeiconsIcon icon={icon} className="size-3.5" aria-hidden />
      {fmtCount(value)}
    </span>
  );
}

export default async function CataloguePage(props: PageProps<"/catalogue">) {
  const filters = parseCatalogueParams(await props.searchParams);
  const [{ tz, items }, options] = await Promise.all([listCatalogue(filters), getCatalogueFilterOptions()]);
  const filtered = !!(filters.q || filters.group || filters.type || filters.year || filters.mine || filters.member);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Catalogue" description="Every RepresENT cover, with YouTube stats." />

      {/* Filters live in the URL so a filtered view can be shared (FR-CAT-2). */}
      <form role="search" className="flex flex-wrap items-center gap-2">
        <Input name="q" type="search" defaultValue={filters.q} placeholder="Search title or artist" aria-label="Search" className="w-full sm:w-56" />
        <NativeSelect name="group" defaultValue={filters.group ?? ""} aria-label="Group">
          <NativeSelectOption value="">All groups</NativeSelectOption>
          {options.groups.map((g) => (
            <NativeSelectOption key={g.id} value={g.id}>{g.name}</NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={filters.type ?? ""} aria-label="Group type">
          <NativeSelectOption value="">All types</NativeSelectOption>
          {GROUP_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>{GROUP_TYPE_LABEL[t]}</NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="year" defaultValue={filters.year ? String(filters.year) : ""} aria-label="Year">
          <NativeSelectOption value="">Any year</NativeSelectOption>
          {options.years.map((y) => (
            <NativeSelectOption key={y} value={y}>{y}</NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="member" defaultValue={filters.member ?? ""} aria-label="Crew member">
          <NativeSelectOption value="">Any member</NativeSelectOption>
          {options.members.map((m) => (
            <NativeSelectOption key={m.id} value={m.id}>{m.name}</NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={filters.sort} aria-label="Sort by">
          <NativeSelectOption value="date">Newest</NativeSelectOption>
          <NativeSelectOption value="views">Most viewed</NativeSelectOption>
          <NativeSelectOption value="likes">Most liked</NativeSelectOption>
          <NativeSelectOption value="comments">Most commented</NativeSelectOption>
        </NativeSelect>
        <label className="flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine} className="size-4 accent-[var(--primary)]" />
          Songs I&apos;m in
        </label>
        <Button type="submit">Apply</Button>
        {filtered ? (
          <Link href="/catalogue" className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {items.length} cover{items.length === 1 ? "" : "s"}
      </p>

      {items.length === 0 ? (
        <EmptyState title="No covers match">Try clearing some filters.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id} className="group flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/50">
              <Link href={`/songs/${c.id}`} className="flex flex-col gap-3">
                <CoverThumb src={c.thumbnailUrl} title={c.title} subtitle={c.groupName} />
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-primary">{c.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.groupName} · {fmtDate(c.publishedAt, tz)}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <Stat icon={ViewIcon} value={c.views} label="views" />
                  <Stat icon={FavouriteIcon} value={c.likes} label="likes" />
                  <Stat icon={Comment01Icon} value={c.comments} label="comments" />
                </div>
                <a
                  href={`https://www.youtube.com/watch?v=${c.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 hover:text-foreground"
                  aria-label={`Watch ${c.title} on YouTube`}
                >
                  <HugeiconsIcon icon={YoutubeIcon} className="size-5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
