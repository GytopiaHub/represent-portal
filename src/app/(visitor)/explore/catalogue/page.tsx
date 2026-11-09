import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { CoverCard, CoverGrid } from "@/features/catalogue/components/cover-card";
import { EXPLORE_PATH } from "@/lib/access";
import { GROUP_TYPES, GROUP_TYPE_LABEL } from "@/lib/labels";
import { DEFAULT_TZ } from "@/lib/time";
import { getPublicCatalogueOptions, listPublicCatalogue, parsePublicCatalogueParams } from "@/server/public/queries";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Every RepresENT K-pop dance cover, with YouTube stats.",
};

const CATALOGUE_PATH = `${EXPLORE_PATH}/catalogue`;

/** Public catalogue of posted covers (FR-PUB-2). Filters live in the URL. */
export default async function PublicCataloguePage(props: PageProps<"/explore/catalogue">) {
  const filters = parsePublicCatalogueParams(await props.searchParams);
  const [items, options] = await Promise.all([listPublicCatalogue(filters), getPublicCatalogueOptions()]);
  const filtered = !!(filters.q || filters.group || filters.type || filters.year || filters.member);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Catalogue" description="Every RepresENT cover, with YouTube stats." />

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
        <Button type="submit">Apply</Button>
        {filtered ? (
          <Link href={CATALOGUE_PATH} className={buttonVariants({ variant: "ghost" })}>
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
            <CoverCard key={c.id} cover={c} href={`${EXPLORE_PATH}/songs/${c.id}`} tz={DEFAULT_TZ} />
          ))}
        </CoverGrid>
      )}
    </div>
  );
}
