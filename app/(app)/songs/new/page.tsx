import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { NewSongForm } from "@/components/song/new-song-form";
import { getGroupsWithRosters } from "@/lib/queries/songs";

export const metadata: Metadata = { title: "Start a song crew" };

export default async function NewSongPage() {
  const groups = await getGroupsWithRosters();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Start a song crew" description="Pick the song and artist — positions are prefilled from the group's roster." />
      <Card>
        <CardContent>
          <NewSongForm groups={groups} />
        </CardContent>
      </Card>
    </div>
  );
}
