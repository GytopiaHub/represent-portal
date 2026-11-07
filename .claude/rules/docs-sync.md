# Keep code, SRS and README aligned

`docs/SRS.md` says what the app must do. `README.md` says how to run and navigate it. Both must describe the code as it actually is at the end of every piece of work.

## What triggers a docs update

| If the change touches… | Update in `docs/SRS.md` | Update in `README.md` |
| --- | --- | --- |
| Behaviour, rules or a feature (FR-*, R-*, AC-*) | The matching §4 requirement and its acceptance criteria | "Things to try", if the demo flow changes |
| The schema (`src/db/schema/**`) | §5 Data Model | — |
| Auth, guards, tokens or the cron secret | §3 / §6 Security | — |
| Routes or pages (`src/app/**`) | §9.2 Routes | "Things to try", if relevant |
| Jobs, cron or endpoints | §7 Server Jobs | "Scheduled jobs" |
| Env vars (`.env.example`) | §2.2 | "Environment" |
| Stack, dependencies or hosting | §2 | Setup sections |
| Folder layout or conventions | Any paths the SRS names (e.g. `src/server/stats.ts`) | "Project structure" |
| Scripts in `package.json` | §8 NFR-6, if relevant | "Scripts" line |
| A decision or assumption made while building | §13 Assumptions & Open Questions | — |

## How to update the SRS

- Bump the version on line 3 (`**Version:** 1.x · **Date:** YYYY-MM-DD`) and add a changelog entry at the top (`- **v1.x:** …`) that says what changed and why.
- Edit the requirement itself. Don't append contradictory notes.
- Keep the SRS's tone and IDs (FR-SONG-3, SEC-7, …). Add new IDs rather than reusing old ones.
- The SRS audience is Claude and RepresENT admins, so keep it plain and specific.

## Before you finish

1. Grep the SRS and README for every file path, route, env var and command you changed. Each mention must still be true.
2. If a docs change isn't needed, say why in your report. A Stop hook (`.claude/hooks/check-docs-sync.sh`) checks for this once per change set.
