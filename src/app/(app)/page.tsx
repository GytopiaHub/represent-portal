import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnChart, HBarChart } from "@/components/charts/lazy";
import { ChartTable } from "@/components/charts/data-table";
import { UpcomingPanel } from "@/features/dashboard/components/upcoming";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { TabLink } from "@/components/layout/nav-link";
import { getViewer } from "@/server/auth-guards";
import { getMyProfile } from "@/server/account/queries";
import { getMemberDashboard, type CoverRef } from "@/server/stats";
import { getSettings, ticksStalled } from "@/server/settings/internal";
import { fmtCount, zonedParts } from "@/lib/time";

function TopCover({ label, items, unit }: { label: string; items: CoverRef[]; unit: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      {items.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        items.map((c) => (
          <Link key={c.id} href={`/songs/${c.id}`} className="font-medium hover:text-primary hover:underline">
            {c.groupName} – {c.title}
            <span className="ml-1 text-sm text-muted-foreground">· {fmtCount(c.value)} {unit}</span>
          </Link>
        ))
      )}
    </div>
  );
}

export default async function DashboardPage(props: PageProps<"/">) {
  const viewer = await getViewer();
  const sp = await props.searchParams;
  const currentYear = zonedParts(new Date(), "Asia/Singapore").year;
  const yearParam = typeof sp.year === "string" ? sp.year : String(currentYear);
  const year = yearParam === "all" ? null : Number(yearParam) || currentYear;

  const [me, stats, settings] = await Promise.all([getMyProfile(), getMemberDashboard(viewer.id, year), getSettings()]);
  const yearOptions = [...new Set([currentYear, ...stats.years])].sort((a, b) => b - a);
  const periodLabel = year ? String(year) : "all time";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <>
            Hey <span className="text-gradient">{me.stageName || me.name || "there"}</span> 👋
          </>
        }
        description="Your covers, stats and what's coming up."
      />

      {viewer.role === "admin" && ticksStalled(settings) ? (
        <Alert variant="destructive">
          <AlertTitle>Scheduled jobs look stalled — check GitHub Actions</AlertTitle>
          <AlertDescription>
            <code>cron/tick</code> hasn&apos;t run in over 3 hours, so YouTube sync and RSVP reminders are paused.{" "}
            <Link href="/admin/settings">Open settings</Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">My stats</h2>
            <nav aria-label="Year" className="flex gap-1 overflow-x-auto">
              {yearOptions.map((y) => (
                <TabLink key={y} href={`/?year=${y}`} active={year === y}>
                  {y}
                </TabLink>
              ))}
              <TabLink href="/?year=all" active={year === null}>
                All time
              </TabLink>
            </nav>
          </div>
          <p className="-mt-4 text-xs text-muted-foreground">
            Counts posted covers where you danced. IC, videographer and editor credits show in My songs but not here.
          </p>

          {stats.songs === 0 ? (
            <EmptyState title={`No posted dance covers for ${periodLabel}`}>
              Try another year, or <Link href="/songs" className="underline">join a song crew</Link>.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Songs covered" value={stats.songs} hint={periodLabel} />
                <StatTile
                  label="Girl / boy group"
                  value={`${stats.byType.girl_group} / ${stats.byType.boy_group}`}
                  hint={`Co-ed ${stats.byType.co_ed} · Solo ${stats.byType.female_solo + stats.byType.male_solo}`}
                />
                <StatTile label="Total views" value={fmtCount(stats.totals.views)} />
                <StatTile
                  label="Likes · comments"
                  value={fmtCount(stats.totals.likes)}
                  hint={`${stats.totals.comments.toLocaleString()} comments`}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile
                  label="Most covered group"
                  value={<span className="text-xl">{stats.topGroups?.names.join(", ")}</span>}
                  hint={stats.topGroups ? `×${stats.topGroups.count}` : undefined}
                />
                <StatTile
                  label="Most covered idol member"
                  value={<span className="text-xl">{stats.topIdols ? `${stats.topIdols.names.join(", ")} ×${stats.topIdols.count}` : "—"}</span>}
                  hint="Custom positions aren't counted"
                />
                <TopCover label="Most viewed" items={stats.mostViewed} unit="views" />
                <TopCover label="Most liked" items={stats.mostLiked} unit="likes" />
                <TopCover label="Most commented" items={stats.mostCommented} unit="comments" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Covers per {year ? "month" : "year"}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <div className="h-[220px]" role="img" aria-label={`Covers per ${year ? "month" : "year"}, ${periodLabel}`}>
                      <ColumnChart data={stats.perPeriod} unit="covers" />
                    </div>
                    <ChartTable caption="Covers per period" rows={stats.perPeriod} unit="Covers" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Group breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <div role="img" aria-label={`Covers by group, ${periodLabel}`}>
                      <HBarChart data={stats.groupBreakdown} unit="covers" />
                    </div>
                    <ChartTable
                      caption="Covers by group"
                      rows={stats.groupBreakdown.map((g) => ({ label: g.name, count: g.count }))}
                      unit="Covers"
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <UpcomingPanel />
      </div>
    </div>
  );
}
