#!/usr/bin/env bash
# Stop hook (see .claude/settings.json and .claude/rules/docs-sync.md).
#
# When Claude is about to finish a turn and the working tree has code changes
# but docs/SRS.md or README.md hasn't been touched, ask Claude once to check
# that the docs still match. It nags once per distinct set of changes and
# never loops.
set -u

input=$(cat)

# Claude is already continuing because of this hook: let it stop.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "$(dirname "$0")/../.." || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

changed=$({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
[ -z "$changed" ] && exit 0

code=$(printf '%s\n' "$changed" | grep -E \
  '^(src|scripts|drizzle|\.github)/|^(package\.json|next\.config\.ts|drizzle\.config\.ts|vercel\.json|\.env\.example|eslint\.config\.mjs|tsconfig\.json)$')
[ -z "$code" ] && exit 0

# A doc counts as updated only if its content changed. Line-ending-only
# differences (CRLF vs LF between Windows and WSL git) don't count.
updated() { ! git diff --quiet --ignore-cr-at-eol HEAD -- "$1" 2>/dev/null; }
missing=""
updated docs/SRS.md || missing="docs/SRS.md"
updated README.md || missing="${missing:+$missing and }README.md"
[ -z "$missing" ] && exit 0

# Nag only once for the same change set.
state="$(git rev-parse --git-dir)/claude-docs-check"
sig=$({ git diff HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | git hash-object --stdin)
[ -f "$state" ] && [ "$(cat "$state")" = "$sig" ] && exit 0
printf '%s' "$sig" > "$state"

files=$(printf '%s\n' "$code" | head -12 | paste -sd ',' - | sed 's/,/, /g')
count=$(printf '%s\n' "$code" | wc -l | tr -d ' ')
reason="Code changed ($count file(s): $files), but these docs are unchanged: $missing. Per .claude/rules/docs-sync.md, check that docs/SRS.md and README.md still match the code and update them (SRS: bump the version and add a changelog entry). If no docs change is needed, say why in your reply."

printf '{"decision":"block","reason":"%s"}\n' "$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g')"
