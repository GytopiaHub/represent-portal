import type { CrewRole, GroupType, SongStatus, SessionKind, BookingStatus } from "@/db/schema";

export const SONG_STATUSES: SongStatus[] = [
  "recruiting",
  "practising",
  "filming",
  "editing",
  "posted",
  "cancelled",
];

export const SONG_STATUS_LABEL: Record<SongStatus, string> = {
  recruiting: "Recruiting",
  practising: "Practising",
  filming: "Filming",
  editing: "Editing",
  posted: "Posted",
  cancelled: "Cancelled",
};

// Consistent status-chip colours (SRS §9.1). Text label is always shown too.
export const SONG_STATUS_CLASS: Record<SongStatus, string> = {
  recruiting: "bg-cyan-400/15 text-cyan-300 ring-cyan-400/30",
  practising: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
  filming: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  editing: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  posted: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

export const CREW_ROLES: CrewRole[] = ["ic", "dancer", "videographer", "editor"];
export const CREW_ROLE_LABEL: Record<CrewRole, string> = {
  ic: "IC",
  dancer: "Dancer",
  videographer: "Videographer",
  editor: "Editor",
};

export const GROUP_TYPES: GroupType[] = ["girl_group", "boy_group", "co_ed", "female_solo", "male_solo"];
export const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  boy_group: "Boy group",
  girl_group: "Girl group",
  co_ed: "Co-ed",
  male_solo: "Male soloist",
  female_solo: "Female soloist",
};

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  practice: "Practice",
  filming: "Filming",
};

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  not_needed: "No booking needed",
  to_book: "Studio to book",
  booked: "Booked",
};
