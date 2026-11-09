import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { CoverCard, CoverGrid } from "@/features/catalogue/components/cover-card";
import { GROUP_TYPES, GROUP_TYPE_LABEL } from "@/lib/labels";
import { getCatalogueFilterOptions, listCatalogue, parseCatalogueParams } from "@/server/catalogue/queries";

export const metadata: Metadata = { title: "Catalogue" };

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
        <CoverGrid>
          {items.map((c) => (
            <CoverCard key={c.id} cover={c} href={`/songs/${c.id}`} tz={tz} />
          ))}
        </CoverGrid>
      )}
    </div>
  );
}
