"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ActionForm, SubmitButton } from "@/components/common/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createSong } from "@/server/songs/actions";
import { GROUP_TYPE_LABEL } from "@/lib/labels";
import type { GroupType } from "@/db/schema";

type Group = { id: string; name: string; groupType: GroupType; isActive: boolean; roster: { id: string; name: string }[] };
type Pos = { key: string; label: string; idolMemberId?: string; customLabel?: string; included: boolean };

function rosterPositions(g: Group | undefined): Pos[] {
  return (g?.roster ?? []).map((m) => ({ key: m.id, label: m.name, idolMemberId: m.id, included: true }));
}

export function NewSongForm({ groups }: { groups: Group[] }) {
  const [groupId, setGroupId] = useState("");
  const [positions, setPositions] = useState<Pos[]>([]);
  const [custom, setCustom] = useState("");

  function pickGroup(id: string) {
    setGroupId(id);
    // FR-SONG-2: prefill from the group's active roster.
    setPositions(rosterPositions(groups.find((g) => g.id === id)));
  }
  function move(i: number, dir: -1 | 1) {
    setPositions((ps) => {
      const next = [...ps];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ps;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addCustom() {
    const label = custom.trim();
    if (!label) return;
    setPositions((ps) => [...ps, { key: `c-${Date.now()}`, label, customLabel: label, included: true }]);
    setCustom("");
  }

  const payload = JSON.stringify(
    positions.filter((p) => p.included).map((p) => (p.idolMemberId ? { idolMemberId: p.idolMemberId } : { customLabel: p.customLabel })),
  );
  const included = positions.filter((p) => p.included).length;

  return (
    <ActionForm action={createSong} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Song title</Label>
          <Input id="title" name="title" required maxLength={120} placeholder="e.g. Supernova" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="groupId">Artist</Label>
          <NativeSelect id="groupId" name="groupId" required value={groupId} onChange={(e) => pickGroup(e.target.value)} className="w-full">
            <NativeSelectOption value="">Pick a group…</NativeSelectOption>
            {groups.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                {g.name} ({GROUP_TYPE_LABEL[g.groupType]}){g.isActive ? "" : " · disbanded"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Group missing? <Link href="/groups#request" className="underline">Request it</Link> — meanwhile use custom positions.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetPostDate">Target post date (optional)</Label>
          <Input id="targetPostDate" name="targetPostDate" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mvUrl">Original MV link (optional)</Label>
          <Input id="mvUrl" name="mvUrl" type="url" placeholder="https://youtube.com/…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="practiceUrl">Dance practice link (optional)</Label>
          <Input id="practiceUrl" name="practiceUrl" type="url" placeholder="https://youtube.com/…" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" name="description" rows={3} maxLength={2000} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">
          Dance positions <span className="font-normal text-muted-foreground">({included})</span>
        </legend>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pick an artist to prefill positions from their roster.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {positions.map((p, i) => (
              <li key={p.key} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5">
                <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={p.included}
                    onChange={(e) => setPositions((ps) => ps.map((x) => (x.key === p.key ? { ...x, included: e.target.checked } : x)))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className={p.included ? "" : "text-muted-foreground line-through"}>{p.label}</span>
                  {p.customLabel ? <span className="text-xs text-muted-foreground">custom</span> : null}
                </label>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, -1)} aria-label={`Move ${p.label} up`} disabled={i === 0}>
                  <HugeiconsIcon icon={ArrowUp01Icon} />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(i, 1)} aria-label={`Move ${p.label} down`} disabled={i === positions.length - 1}>
                  <HugeiconsIcon icon={ArrowDown01Icon} />
                </Button>
                {p.customLabel ? (
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setPositions((ps) => ps.filter((x) => x.key !== p.key))} aria-label={`Remove ${p.label}`}>
                    <HugeiconsIcon icon={Delete02Icon} />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder='Custom position, e.g. "Center"'
            maxLength={40}
            aria-label="Custom position label"
          />
          <Button type="button" variant="outline" onClick={addCustom}>
            Add
          </Button>
        </div>
        <input type="hidden" name="positions" value={payload} />
      </fieldset>

      <p className="text-sm text-muted-foreground">You&apos;ll be the IC. You can invite members and assign guests next.</p>
      <SubmitButton className="glow self-start" pendingLabel="Creating…">
        Create song crew
      </SubmitButton>
    </ActionForm>
  );
}
