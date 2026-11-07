// Half-open [start, end) interval maths on epoch milliseconds.

export type Interval = { start: number; end: number };

export function merge(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function union(...lists: Interval[][]): Interval[] {
  return merge(lists.flat());
}

/** a − b */
export function subtract(a: Interval[], b: Interval[]): Interval[] {
  const bs = merge(b);
  const out: Interval[] = [];
  for (const i of merge(a)) {
    let cur = i.start;
    for (const x of bs) {
      if (x.end <= cur || x.start >= i.end) continue;
      if (x.start > cur) out.push({ start: cur, end: x.start });
      cur = Math.max(cur, x.end);
      if (cur >= i.end) break;
    }
    if (cur < i.end) out.push({ start: cur, end: i.end });
  }
  return out;
}

export function overlaps(list: Interval[], s: number, e: number) {
  return list.some((i) => i.start < e && i.end > s);
}

/** True if [s, e) lies entirely inside one interval of `list`. */
export function covers(list: Interval[], s: number, e: number) {
  return merge(list).some((i) => i.start <= s && i.end >= e);
}

export function clip(list: Interval[], s: number, e: number): Interval[] {
  return list
    .map((i) => ({ start: Math.max(i.start, s), end: Math.min(i.end, e) }))
    .filter((i) => i.end > i.start);
}
