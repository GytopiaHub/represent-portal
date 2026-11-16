// The channel also posts side cams, relay dances, vlogs and Shorts. The Data
// API can't filter uploads by type, so official covers are picked by title.

// Tags that mark an extra rather than an official cover. Add new ones here
// when the crew starts a new kind of extra.
const EXTRA_TAGS =
  /SIDE CAM|RELAY DANCE|REP[- ]?ENT\+|RE-TREAT|RepresENTERTAINMENT|BUSKING|FUN RUN|VLOG/i;

// A cover title carries "[RepresENT]" or "COVER", but some carry only one of
// the two. "COVER" is matched in capitals so Shorts hashtags such as
// "#andteamdancecover" don't count.
const COVER_MARKER = /RepresENT|\bCOVER\b/;

export function isOfficialCover(title: string) {
  return COVER_MARKER.test(title) && !EXTRA_TAGS.test(title);
}
