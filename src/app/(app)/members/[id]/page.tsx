import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleChip } from "@/components/common/chips";
import { EmptyState, SectionTitle } from "@/components/layout/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { UserAvatar } from "@/components/common/user-avatar";
import type { CrewRole } from "@/db/schema";
import { getMemberProfile } from "@/server/members/queries";
import { fmtCount, fmtDate } from "@/lib/time";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage(props: PageProps<"/members/[id]">) {
  const { id } = await props.params;
  const data = await getMemberProfile(id);
  if (!data) notFound();
  const { user, posted, stats, tz, isMe } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <UserAvatar name={user.name} image={user.image} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{user.stageName || user.name}</h1>
          <p className="text-muted-foreground">
            {user.stageName ? `${user.name} · ` : ""}
            {user.instagramHandle ? (
              <a href={`https://instagram.com/${user.instagramHandle}`} target="_blank" rel="noreferrer" className="hover:underline">
                @{user.instagramHandle}
              </a>
            ) : null}
            {user.role === "admin" ? " · Admin" : ""}
            {user.status === "removed" ? " · Former member" : ""}
          </p>
        </div>
        {isMe ? (
          <Link href="/onboarding" className="ml-auto text-sm text-primary hover:underline">Edit profile</Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Covers danced" value={stats.songs} hint="all time" />
        <StatTile label="Total views" value={fmtCount(stats.totals.views)} />
        <StatTile label="Most covered group" value={<span className="text-lg">{stats.topGroups?.names.join(", ") ?? "—"}</span>} hint={stats.topGroups ? `×${stats.topGroups.count}` : undefined} />
        <StatTile label="Most covered member" value={<span className="text-lg">{stats.topIdols?.names.join(", ") ?? "—"}</span>} hint={stats.topIdols ? `×${stats.topIdols.count}` : undefined} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>Posted songs ({posted.length})</SectionTitle>
        {posted.length === 0 ? (
          <EmptyState title="No posted songs yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {posted.map((s) => (
              <li key={s.id}>
                <Link href={`/songs/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/50">
                  <span className="min-w-0 flex-1">
                    <span className="text-sm text-muted-foreground">{s.groupName}</span>
                    <span className="block truncate font-semibold">{s.title}</span>
                  </span>
                  <span className="flex gap-1">{s.roles.map((r) => <RoleChip key={r} role={r as CrewRole} />)}</span>
                  <span className="text-sm text-muted-foreground">{fmtCount(s.views)} views · {fmtDate(s.publishedAt, tz)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
