# RepresENT Portal

Crew portal for RepresENT, a K-pop dance cover crew: song crews, recruiting, availability, practices and filming, the cover catalogue and personal stats. The spec is [docs/SRS.md](docs/SRS.md).

Stack: Next.js 16 (App Router, Cache Components) · Neon Postgres · Drizzle · Auth.js (Google, database sessions) · Tailwind + shadcn/ui · Recharts.

## Quick start

```bash
cp .env.example .env      # fill in DATABASE_URL, AUTH_*, TOKEN_ENCRYPTION_KEY, SEED_ADMIN_EMAIL
npm install
npm run db:reset          # drops everything, recreates the schema, loads demo data
npm run dev
```

Sign in with the Google account in `SEED_ADMIN_EMAIL`. It is seeded as an admin who already belongs to several crews, so the dashboard, catalogue and schedules have data straight away. Any other Google account signs up as *pending* and shows up under **Admin → Approvals**.

## Demo mode (`GOOGLE_APIS=mock`)

Google sign-in is real. Google Calendar and YouTube are **simulated** until you switch to `GOOGLE_APIS=live`:

| Feature | In mock mode |
| --- | --- |
| Calendar list (onboarding) | Four fake calendars (Personal, Work, Uni timetable, Holidays) |
| FreeBusy (avails, heatmap, flags) | Deterministic busy blocks per member: office worker, student or shift worker, plus random evening plans |
| Calendar write-back | Records an event mapping; members with no calendars selected "fail" (to demo *Calendar not updated for X*) |
| YouTube sync | The channel is "whatever is in the DB", plus two new uploads that the first **Sync YouTube now** imports. Stats grow a little each run |

The mock code lives in `src/server/mock/`. The live code paths (`src/server/google.ts`, `src/server/youtube-sync.ts`) are written but not yet exercised.

### Things to try

- **Dashboard:** year selector, stat tiles and ties ("Hanni (NewJeans), Karina (aespa) ×2"), charts, plus *Upcoming* with two pending invitations to accept or decline.
- **Songs → Supernatural** (you're IC):
  - **Crew** tab: invite members (with free hours and active-crew counts), assign or create guests, add custom positions.
  - **Avails** tab: heatmap and suggested slots; "Schedule →" prefills a practice.
- **Songs → Accendio:** a practice within 24 h. Open it to see the availability flags, RSVP grid and calendar status.
- **Songs → HOT** (you're editor): the **Video** tab suggests the matching upload, so link it, then set the status to Posted.
- **Admin:**
  - **Approvals:** two pending users and one rejected.
  - **Backfill queue:** create song records from old uploads, or mark them "not a cover".
  - **Settings:** *Sync YouTube now*, *Run tick now* (sends RSVP reminders), and the stalled-jobs warning.
- **Public pages (signed out):** open the site in a private window. `/` goes to **/explore**, with the channel stats (hard-coded placeholders for now), the most popular covers and the top groups. **Catalogue** filters work without signing in, and opening a cover shows its embedded video and credits. Member pages still redirect to `/login`.

## Environment

See [.env.example](.env.example). In production, set them in Vercel (and `APP_URL` + `CRON_SECRET` as GitHub Actions secrets).

## Google OAuth client

1. Google Cloud Console → enable the **Google Calendar API** (and **YouTube Data API v3** for an API key).
2. OAuth consent screen: add scopes `calendar.readonly` and `calendar.events`, then **publish to In production**. In Testing mode, refresh tokens expire after 7 days. Members will see an "unverified app" warning, which the login and onboarding screens explain.
3. Credentials → OAuth client ID (Web application). Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`, plus your production URL.

## Scheduled jobs

`/api/cron/tick` (bearer `CRON_SECRET`) does the following:
- runs the YouTube sync once a day after the configured time
- sends RSVP reminders for sessions in the next 24 h
- retries failed calendar writes (up to 3 attempts)
- prunes the FreeBusy cache

It's idempotent. It's called by:
- `.github/workflows/cron.yml`: hourly.
- `.github/workflows/keepalive.yml`: monthly. It re-enables the cron, because GitHub disables schedules in quiet public repos.
- `vercel.json`: a daily fallback.

## Project structure

```
src/
  app/                 routing only: (public) status screens, (visitor) signed-out /explore pages, (app) member pages, onboarding, api/
  features/<domain>/   UI for one domain (songs, schedule, availability, account, …)
  components/          shared UI: ui/ (shadcn), layout/ (shell, nav), common/, charts/
  server/              the only code that touches the database (SEC-1)
  db/                  Drizzle client, schema/ (one file per domain), types, errors
  lib/                 framework-free helpers usable anywhere (time, intervals, labels)
  auth.ts, proxy.ts    Auth.js config; route gating by user status (UX only)
scripts/               db:reset and db:seed (fictional data only)
```

Imports only point down: `app → features → components, lib` and `app, features → server → db, lib`. ESLint enforces this (`eslint.config.mjs`). Type-only imports are always allowed.

### Inside `src/server`

| Path | What it holds |
| --- | --- |
| `auth-guards.ts` | `requireActiveUser`, `requireAdmin`, `requireSongEditor`, `requireSelf`, `activeUserOrResponse`, plus `publicRead` (marks an intentionally public read) |
| `public/queries.ts` | The only reads visitors can reach (`/explore`): posted covers and credits only, Zod-validated, cached for an hour |
| `youtube-channel.ts` | `getChannelInfo()`: channel profile for `/explore` (hard-coded until the YouTube channel API is wired up) |
| `action.ts` | Server Action plumbing: `run`, `parse` (Zod), `UserError`, common field schemas |
| `<domain>/queries.ts` | Reads for pages. Each one starts with a guard. |
| `<domain>/actions.ts` | `"use server"` mutations: guard → Zod → write → notify → `refresh()` → `after(calendar sync)` |
| `<domain>/*.ts` (anything else) | Unguarded helpers for other server code. Callers authorize first. Never export these from an `actions.ts`, because every export there becomes a callable endpoint. |
| `google.ts` | The only code that decrypts OAuth tokens |
| `calendar-sync.ts`, `youtube-sync.ts`, `stats.ts`, `notify.ts` | Cross-cutting services named in the SRS |
| `jobs/tick.ts` | What `/api/cron/tick` runs |
| `mock/` | Simulated Google APIs and their fixtures |

Domains: `account`, `availability`, `catalogue` (and backfill), `crew` (recruiting), `dashboard`, `groups`, `guests`, `members`, `notifications`, `public` (signed-out visitors), `schedule` (practices and filming), `settings`, `songs`.

### Adding a feature

1. Tables go in `src/db/schema/<domain>.ts`, re-exported from `schema/index.ts`.
2. Add `src/server/<domain>/queries.ts` and `actions.ts`.
3. Add UI in `src/features/<domain>/components/`.
4. Add the route under `src/app/`. Keep the page thin.

Scripts: `db:reset` (drop, push, seed; `-- --no-seed` to skip the seed), `db:seed`, `db:studio`.
