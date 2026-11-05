# RepresENT Portal — Software Requirements Specification

**Version:** 1.2 · **Date:** 2026-11-04 · **Audience:** Claude (implementation agent) and RepresENT admins

> **Changelog**
> - **v1.2:** The GitHub repo is **public**, so Vercel Hobby can deploy it. Added public-repo rules (no secrets or real member data in the repo, secret scanning), a keepalive for the scheduled GitHub Actions workflow, and a stale-cron warning for admins.
> - **v1.1:** Stack changed from Vite + React + Supabase to **Next.js (App Router) + Neon Postgres + Auth.js + Drizzle ORM** on Vercel. Authorization moves from Postgres RLS to a server-side authorization layer. Scheduled jobs move to GitHub Actions. Live notifications use polling instead of Supabase Realtime.
> - **v1.0:** Initial spec.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for the **RepresENT Portal**, a web app for RepresENT, a K-pop dance cover crew. It is the source of truth for building the app. When anything is unclear, follow this document and record the decision in §13 (Assumptions & Open Questions).

### 1.2 Product summary
Members use the portal to:
- start song covers (**song crews**) as an IC
- check other members' availability, which comes from Google Calendar
- recruit members into slots that match the original idol group's members
- schedule practices and filming, and sync them to everyone's Google Calendar
- browse a catalogue of every RepresENT cover, with YouTube stats synced automatically
- see their own history and a personal stats dashboard

### 1.3 Definitions
| Term | Meaning |
|---|---|
| **Member** | An approved RepresENT user who signs in with Google. |
| **Admin** | A member with system-management rights. Admins can also do everything a member can. |
| **Pending user** | Someone who signed in but has not yet been approved by an admin. |
| **Song crew / Song** | One cover project: a song by an idol group, plus the people working on it. |
| **IC** | "In charge." The person who starts and runs a song crew. A song can have more than one IC. |
| **Crew role** | `IC`, `Dancer`, `Videographer`, `Editor`. |
| **Idol group / Artist** | The original K-pop act (a group or a soloist). |
| **Idol member** | A member of an idol group, such as "Minji" in NewJeans. |
| **Dance position** | A slot in a song crew that maps to one idol member, or a custom slot. |
| **Guest** | A person outside RepresENT, stored by name, who can be credited on a song. |
| **Avails** | When a member is free. Calculated from Google Calendar busy/free plus manual overrides. |

### 1.4 Scale & constraints
- **Users:** fewer than 30 members (this is a design assumption, not a hard cap).
- **Cost:** must run entirely on **free tiers**.
- **Default time zone:** `Asia/Singapore`. Store all times in UTC and display them in the user's local time zone.
- **Devices:** fully responsive. Mobile-first, because most members will use phones.

---

## 2. Technology & Hosting

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server Components for reads. Server Actions for mutations. Route Handlers (`app/api/**`) for cron and JSON endpoints. |
| Database | **Neon Postgres** (Free plan) | Use the `@neondatabase/serverless` driver with the **pooled** connection string. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Schema lives in `src/db/schema.ts`; migrations in `drizzle/`. |
| Auth | **Auth.js (NextAuth v5)**, Google provider, Drizzle adapter | **Database** session strategy, so approval and role changes apply immediately. |
| Validation | **Zod** | Validate every Server Action and Route Handler input. |
| UI | Tailwind CSS + shadcn/ui (Radix) | Charts with Recharts (lazy-loaded). |
| Client data | Server Components + `revalidatePath`/`revalidateTag`; TanStack Query only where client polling is needed | |
| Hosting | **Vercel Hobby** (free) | Personal, non-commercial use fits Hobby terms. |
| Scheduler | **GitHub Actions** scheduled workflow | Vercel Hobby cron jobs can only run once per day, which is too infrequent for RSVP reminders (§7). |
| Google APIs | **Google Calendar API**, **YouTube Data API v3** via `googleapis` | Called **server-side only**. |

### 2.1 Free-tier considerations (must handle)
1. **Neon scale-to-zero:** compute suspends after 5 minutes idle. The first request after that adds a short cold-start delay. This is acceptable; show loading skeletons. The free plan's monthly compute-hour and 0.5 GB storage allowances are far more than this app needs at fewer than 30 users. Never store images or video in the database; store URLs only.
2. **Vercel Hobby:** functions have execution time limits. Keep each cron run short, for example by syncing YouTube in batches of 50 videos and writing calendar events concurrently with a cap.
3. **GitHub Actions cron:** a free scheduled workflow (`.github/workflows/cron.yml`) calls `POST /api/cron/tick` hourly, authenticated with a `CRON_SECRET` bearer token.
   - The repo is **public**, so Actions minutes are free and unlimited for standard runners.
   - GitHub **automatically disables scheduled workflows in public repos after 60 days with no repo activity.** Mitigations (all required):
     - a `keepalive.yml` workflow that runs monthly and keeps the schedule active, either with a maintained keepalive action or by re-enabling the workflow via `gh workflow enable` with the built-in token
     - a once-daily **Vercel cron** to the same endpoint as a fallback, so the YouTube sync and reminders still run, just less often
     - the `cron/tick` endpoint records `app_settings.last_tick_at`. If that is more than 3 hours old, admins see a "Scheduled jobs look stalled — check GitHub Actions" warning on `/admin/settings` and the dashboard.
   - RSVP reminders select "sessions in the next 24 h with no reminder sent yet", tracked with `session_reminders`. A delayed or daily-only tick still sends every reminder, never duplicates.
4. **YouTube API quota:** 10,000 units per day. A full sync uses `playlistItems.list` on the channel's uploads playlist (1 unit per 50 videos) plus `videos.list` (1 unit per 50 IDs), so a sync costs only a few units.
5. **Google OAuth verification:** Calendar scopes are *sensitive*.
   - With the OAuth consent screen in **Testing** mode, refresh tokens expire after 7 days. **Do not ship in Testing mode.**
   - Publish the app to **In production**. An unverified app works for up to 100 users, but users see an "unverified app" warning. This is acceptable for fewer than 30 members. Document the warning in onboarding.

### 2.2 Environment variables
`DATABASE_URL` (Neon pooled), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `TOKEN_ENCRYPTION_KEY` (32-byte base64), `YOUTUBE_API_KEY`, `CRON_SECRET`, `APP_URL`.

---

## 3. Users, Roles & Permissions

### 3.1 System roles
| Capability | Pending | Member | Admin |
|---|:-:|:-:|:-:|
| Sign in with Google | ✅ | ✅ | ✅ |
| See "awaiting approval" screen only | ✅ | | |
| Browse catalogue, own history, dashboard | | ✅ | ✅ |
| Connect Google Calendar, manage own avails | | ✅ | ✅ |
| Start a song crew (becomes IC) | | ✅ | ✅ |
| Edit a song crew | | ICs of that song only | ✅ (any song) |
| Approve or reject signups | | | ✅ |
| Promote/demote admins, remove members | | | ✅ |
| Manage idol groups and rosters | | | ✅ |
| Change system settings | | | ✅ |
| Tag imported/past videos with crews and roles | | ICs of that song | ✅ |

**Rules**
- **R-ROLE-1:** A new sign-in creates a user with `status = pending`. Pending users cannot read any app data. Enforce this **on the server**: in `middleware.ts` (redirect) **and** in every data-access function and Server Action (see §6). Hiding things in the UI is not enough.
- **R-ROLE-2:** Admins can approve (→ `active`) or reject (→ `rejected`). Rejected users see a "not approved" screen and can be re-approved later.
- **R-ROLE-3:** The **first user** to sign in on an empty database becomes an `active` admin automatically (bootstrap). Do this in the Auth.js `events.createUser` callback, inside a transaction.
- **R-ROLE-4:** The last remaining admin cannot be demoted or removed.
- **R-ROLE-5:** "Removing" a member sets `status = removed`. It is a soft delete: their history stays visible in the catalogue, they can no longer sign in to the app, and their sessions are deleted.

### 3.2 Crew roles (per song)
- Roles: `IC`, `Dancer`, `Videographer`, `Editor`.
- Each role assignment is held by either a **member** (linked account) or a **guest** (from the reusable guest list).
- **Allowed:**
  - one person can hold several roles in the same song (for example, dancer + editor)
  - a song can have several ICs
  - a song can have several videographers and editors
- **Not allowed:** two people sharing one dance position. Each dance position has at most one assignee.
- A song must always have **at least one IC who is a member**. The creator becomes the first IC.

---

## 4. Functional Requirements

### 4.1 Authentication & Onboarding
- **FR-AUTH-1:** Sign in only with Google, using Auth.js's Google provider with the Drizzle adapter (tables `users`, `accounts`, `sessions`, `verification_tokens`).
- **FR-AUTH-2:** Request the scopes `openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events`. Use `authorization.params = { access_type: "offline", prompt: "consent", include_granted_scopes: "true" }` so a refresh token is always returned.
- **FR-AUTH-3:** The adapter stores `access_token`, `refresh_token` and `expires_at` in `accounts`. These tokens must be **encrypted at rest**: wrap the adapter's `linkAccount` to encrypt them with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`. Only the server-side `googleClient(userId)` helper decrypts them. That helper refreshes the access token when it has expired and saves the new one.
- **FR-AUTH-4:** If the refresh token is missing or revoked (`invalid_grant`), set `accounts.token_error`. Show a "Reconnect Google Calendar" banner, which re-runs sign-in with consent. Calendar features degrade gracefully: that member's avails show as "unknown".
- **FR-AUTH-5:** Onboarding after approval:
  1. confirm display name, stage name (optional) and Instagram handle (optional)
  2. pick which Google calendars count toward busy time (multi-select from `calendarList`)
  3. explain the unverified-app warning and the calendar write behaviour

### 4.2 Admin: Member Management
- **FR-ADM-1:** Pending-approvals list showing name, email, Google avatar and signup time, with Approve and Reject actions.
- **FR-ADM-2:** Members list with search. For each member: promote to admin, demote to member, remove, or restore.
- **FR-ADM-3:** A badge on the admin nav item shows how many approvals are pending.
- **FR-ADM-4:** Approved users get an in-app notification on their next sign-in ("You've been approved").

### 4.3 Admin: System Settings
Stored in a single-row `app_settings` table.
| Setting | Default |
|---|---|
| YouTube channel ID | (empty; must be set before sync runs) |
| YouTube sync time (daily, SGT) | 04:00 |
| Default practice duration | 2 h |
| Default filming duration | 3 h |
| Availability window (hours considered "schedulable" each day) | 09:00–23:00 |
| Availability look-ahead | 8 weeks |
| Default time zone | Asia/Singapore |

- **FR-SET-1:** Only admins can edit settings. Changes take effect immediately. The hourly `cron/tick` reads the sync time from settings and runs the YouTube sync when it is due, so no redeploy is needed to change the schedule.
- **FR-SET-2:** A "Sync YouTube now" button triggers a manual sync and shows the result of the last run (time, videos added, errors).

### 4.4 Admin: Idol Groups & Rosters
- **FR-GRP-1:** Admins can create and edit **idol groups** with: name, optional Korean name, type (`boy_group`, `girl_group`, `co_ed`, `male_solo`, `female_solo`), optional image URL, and active/disbanded flag.
- **FR-GRP-2:** Admins can add, edit and deactivate **idol members** of a group (name, optional romanisation, image). Deactivate rather than delete, so historical songs keep their positions.
- **FR-GRP-3:** Roster changes affect **new** songs only. Existing songs keep their stored positions.
- **FR-GRP-4:** Members (non-admins) can view groups and rosters. If a group is missing they can **request** that it be added, which sends an admin notification. While waiting, an IC can still create a song with custom positions (FR-SONG-3).

### 4.5 Song Crews
#### Creation & details
- **FR-SONG-1:** Any member can start a song crew by entering: song title, artist (pick from idol groups), optional target post date, optional reference links (original MV and dance practice video), and an optional description. The creator becomes IC.
- **FR-SONG-2:** After the group is picked, **dance positions are prefilled** from the group's active roster. The IC unticks idol members who are not in this song.
- **FR-SONG-3:** The IC can add **custom positions** (free text, such as "Center", "Backup 1") and reorder positions.
- **FR-SONG-4:** Status lifecycle: `Recruiting → Practising → Filming → Editing → Posted`, plus `Cancelled`. The IC sets the status manually. Any transition is allowed (moving back is fine). `Posted` requires a YouTube video to be linked (§4.8).

#### Recruiting
- **FR-SONG-5:** For each slot (dance position, videographer, editor, extra IC), the IC can:
  - **invite a member**, which creates an invitation with status `pending`, or
  - **assign a guest** directly from the guest list, or create a new guest inline. Guests need no acceptance.
- **FR-SONG-6:** The invitee gets an in-app notification and can **Accept** or **Decline**. They are only added to the crew after accepting. The IC can cancel a pending invite.
- **FR-SONG-7:** While choosing whom to invite, the IC sees each member's **availability summary** across the song's planned practice period (§4.6). This includes each member's number of active crews, as a rough indicator of workload.
- **FR-SONG-8:** The IC can remove a crew member. That member is notified, and their future calendar events for this song are deleted.
- **FR-SONG-9:** An open dance position is clearly shown as "Unfilled" on the song page.

#### Guests
- **FR-GST-1:** Guests are stored in a reusable list with: name (required), optional Instagram handle, optional contact note. Any member can create guests. Any member can edit a guest they created; admins can edit all guests.
- **FR-GST-2:** Guests are credited in the catalogue by name.

### 4.6 Availability
- **FR-AV-1:** A member's availability for a time range = **(availability window) − (Google busy blocks from their selected calendars) − (manual busy blocks) + (manual free blocks)**. Manual blocks override Google.
- **FR-AV-2:** Busy blocks come from the Google Calendar **FreeBusy API**, called server-side with each member's own token. Event details (titles and so on) are never fetched or stored, only busy intervals.
- **FR-AV-3:** Events that RepresENT itself created (practices and filming) are **excluded** from busy computation. Do this by subtracting the member's own scheduled RepresENT sessions from the returned busy intervals. Otherwise a member would look busy during their own practice.
- **FR-AV-4:** Manual overrides: members can add, edit and delete blocks marked "Busy" or "Free", one-off or weekly recurring, with an optional note.
- **FR-AV-5:** "My Availability" page: a week view showing Google busy blocks (grey), manual blocks (coloured), and practices/filming (accent colour). It has a "Refresh from Google" action.
- **FR-AV-6:** **Crew avails view (IC):** a week grid or heatmap for the selected crew members (or any members while recruiting). Each cell shows how many people are free, and hovering or tapping it lists who is busy. On mobile this collapses to a day-by-day list.
- **FR-AV-7:** **Suggested slots:** given a duration and date range, the app lists the top time slots ranked by number of crew members free. Ties go to earlier dates.
- **FR-AV-8:** Busy intervals are fetched on demand by `GET /api/avails?members=…&from=…&to=…`, which calls FreeBusy for all requested members concurrently. Results are cached for 15 minutes per member and range in a `freebusy_cache` table. "Refresh from Google" bypasses the cache.

### 4.7 Practices & Filming
#### Practices
- **FR-PR-1:** ICs can create, edit and cancel practices with: date, start/end time (defaulting to the default duration), location (free text plus optional map link), studio booking status (`not_needed`, `to_book`, `booked`) with an optional booking reference, notes, and reference links.
- **FR-PR-2:** **Unavailable flagging:** for each practice, each crew member is shown as Available, **Unavailable** (busy overlaps the practice), or Unknown (no calendar connected). Recalculate whenever the practice page is viewed or the practice is edited.
- **FR-PR-3:** **RSVP:** each crew member can mark Going or Can't make it, with an optional reason. A status grid for each practice shows RSVP and the availability flag side by side.
- **FR-PR-4:** Practices appear in a song's schedule tab and in each member's "Upcoming" list.

#### Filming
- **FR-FM-1:** ICs can create one or more filming sessions with: date, start/end time, a list of **candidate locations** (each with name, map link and notes, with one marked as final once decided), assigned videographer(s) from the crew's videographer role, notes, and an optional outfit/props checklist (free text).
- **FR-FM-2:** Filming sessions get the same unavailable flagging and RSVP as practices.

#### Google Calendar write-back
- **FR-CAL-1:** When a practice or filming session is created, the server creates an event **in every crew member's primary Google Calendar**, using that member's own token. Event title: `[RepresENT] <Song> – Practice` or `– Filming`. The description includes the location, notes and a link back to the portal.
- **FR-CAL-2:** Editing a session updates every member's event. Cancelling or deleting a session deletes the events.
- **FR-CAL-3:** A member joining a crew gets events for all future sessions. A member leaving or being removed has all their future events deleted.
- **FR-CAL-4:** Store `(session_id, user_id, google_event_id)` mappings. Tag events with `extendedProperties.private.represent_session_id` for traceability.
- **FR-CAL-5:** Calendar sync runs **after** the database write commits, using `after()` from `next/server` so the user isn't kept waiting.
  - Failures, such as a revoked token, are logged in `calendar_events.last_error`, and the IC sees "Calendar not updated for X". This never blocks saving the session.
  - The hourly `cron/tick` retries failed syncs, up to 3 attempts.
- **FR-CAL-6:** Guests get no calendar events.

### 4.8 Catalogue & YouTube Sync
- **FR-CAT-1:** The catalogue lists **all posted RepresENT covers**. Each card shows: thumbnail, song title, artist/group, date posted, views, likes, comments, and a YouTube link that opens the video. Optionally, a "Play" action opens an embedded player.
- **FR-CAT-2:** Filters: group, group type (boy/girl/co-ed/solo), year, a "songs I'm in" toggle, and crew member. Sort by date posted, views, likes or comments. Text search on title and artist. Filters live in URL search params so filtered views can be shared.
- **FR-CAT-3:** The song detail page shows the full crew credit list: ICs, dancers with their positions (for example, "Jamie as Hanni"), videographers and editors. Members and guests are distinguished. It also shows a stats history sparkline once daily snapshots exist.
- **FR-YT-1:** The YouTube sync job (§7) syncs the configured channel's **uploads playlist**:
  - new videos are inserted into `youtube_videos` (video ID, title, published date, thumbnail, duration)
  - stats (`viewCount`, `likeCount`, `commentCount`) are refreshed for all videos
  - a daily snapshot is written to `video_stats_history`
  - each run is logged in `sync_runs`
- **FR-YT-2:** **Linking:** the IC (or an admin) links a song crew to a synced video by choosing from the list of unlinked videos. Optionally, the system suggests matches by fuzzy title comparison (`pg_trgm` similarity). Linking sets the song's posted date from the video and allows status `Posted`.
- **FR-YT-3:** **Backfill:** on first sync, every existing channel video is imported as "untagged". An admin **Backfill queue** page lists untagged videos. Admins (or the IC once assigned) create a song crew record for each video, with group, positions and crew assignments, members or guests. They can also mark a video "Not a cover / ignore" (for example, a vlog or announcement).
- **FR-YT-4:** For backfilled songs, crew assignments are recorded directly with no invitation flow. Practices and filming are optional for them.

### 4.9 Member History
- **FR-HIS-1:** "My Songs" lists every song (in any status) the member has accepted a role in. It shows status, group, their role(s), their dance position(s) and the posted date. It is filterable by role and status. Cancelled songs are shown greyed out.
- **FR-HIS-2:** A member's public profile page (visible to other members) shows their posted songs and headline stats.

### 4.10 Dashboard (personal stats)
**Counting rule:** stats count only **posted** songs where the member held a **Dancer** role. ICs, videographers and editors appear in history but are **excluded** from all dashboard stats.

- **FR-DB-1:** A year selector, defaulting to the current year, plus "All time". The year is taken from the video's published date in Asia/Singapore time.
- **FR-DB-2:** Stat tiles and charts:
  - songs covered (selected year / all time)
  - split by group type: boy group vs girl group, with co-ed and solo shown separately
  - **most covered group** (count)
  - **most covered idol member** (shown as "Hanni (NewJeans) ×3"; custom positions are excluded)
  - **most viewed** cover, with a link
  - **most liked** cover, with a link
  - **most commented** cover, with a link
  - total views, likes and comments across their covers
  - covers per month (bar chart)
  - group breakdown (bar or donut)
- **FR-DB-3:** Ties are shown together, for example "NewJeans, IVE (×4)".
- **FR-DB-4:** An "Upcoming" panel on the dashboard: next practices/filming, pending invitations, and RSVPs needed. This panel shows all of the member's crews, not only dancer roles.
- **FR-DB-5 (optional, nice-to-have):** A crew-wide stats page with totals for RepresENT overall (top groups, top songs, covers per year).
- **Implementation:** a single server-side query module, `src/server/stats.ts` (`getMemberDashboard(userId, year?)`), using SQL aggregates via Drizzle. No client-side aggregation.

### 4.11 Notifications (in-app only)
- **FR-NOT-1:** A bell icon with an unread count, a notification list, and a mark-read / mark-all-read action.
  - The unread count is **polled** every 60 s while the tab is visible (TanStack Query `refetchInterval` + `refetchOnWindowFocus`), and refreshed after any of the user's own actions.
  - No websockets are needed.
- **FR-NOT-2:** Triggers:
  - signup approved
  - invited to a song
  - invite accepted or declined (sent to the ICs)
  - removed from a crew
  - practice/filming created, changed or cancelled
  - RSVP needed (24 h before a session with no RSVP, created by `cron/tick`)
  - song status changed
  - group requested (sent to admins)
  - new signup pending (sent to admins)
  - calendar write failure (sent to the affected member and the ICs)

---

## 5. Data Model (Neon Postgres via Drizzle)

> All app tables have `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()` and `updated_at timestamptz`. Times are stored as `timestamptz`. Enable the `pg_trgm` extension.

```
-- Auth.js (Drizzle adapter) tables, extended
users               (id, name, email unique, email_verified, image,
                     display_name, stage_name, instagram,
                     system_role enum['member','admin'] default 'member',
                     status enum['pending','active','rejected','removed'] default 'pending',
                     timezone default 'Asia/Singapore', approved_by, approved_at)
accounts            (user_id, type, provider, provider_account_id, access_token (encrypted),
                     refresh_token (encrypted), expires_at, scope, token_type, id_token,
                     token_error text null)                                   -- server-only
sessions            (session_token pk, user_id, expires)
verification_tokens (identifier, token, expires)

member_calendars    (user_id, google_calendar_id, summary, include_in_busy bool)
avail_overrides     (user_id, kind enum['busy','free'], starts_at, ends_at,
                     recurrence enum['none','weekly'], recurrence_until date, note)
freebusy_cache      (user_id, range_start, range_end, busy jsonb, fetched_at)  UNIQUE(user_id, range_start, range_end)

idol_groups         (name, name_kr, group_type enum['boy_group','girl_group','co_ed','male_solo','female_solo'],
                     image_url, is_active)
idol_members        (group_id fk, name, image_url, sort_order, is_active)
group_requests      (requested_by, name, note, status enum['open','done','rejected'])

guests              (name, instagram, contact_note, created_by)

songs               (title, group_id fk, status enum['recruiting','practising','filming','editing','posted','cancelled'],
                     target_post_date, description, reference_links jsonb, youtube_video_id fk null unique,
                     created_by, is_backfill bool)
song_positions      (song_id, idol_member_id null, custom_label null, sort_order)      -- CHECK: exactly one of the two
song_assignments    (song_id, role enum['ic','dancer','videographer','editor'], position_id null (dancer only),
                     user_id null, guest_id null)                                     -- CHECK: exactly one of user/guest
                     UNIQUE(position_id) WHERE position_id IS NOT NULL
song_invitations    (song_id, role, position_id null, invitee_user_id, invited_by,
                     status enum['pending','accepted','declined','cancelled'], responded_at)

sessions_sched      (song_id, kind enum['practice','filming'], starts_at, ends_at, location_text, location_url,
                     booking_status enum['not_needed','to_book','booked'], booking_ref, notes,
                     reference_links jsonb, checklist text, status enum['scheduled','cancelled'], created_by)
                     -- named sessions_sched to avoid clashing with Auth.js `sessions`
filming_locations   (session_id, name, map_url, notes, is_final bool)
session_videographers (session_id, assignment_id)
session_rsvps       (session_id, user_id, response enum['going','not_going'], reason)  UNIQUE(session_id, user_id)
calendar_events     (session_id, user_id, google_event_id null, sync_state enum['ok','pending','failed'],
                     attempts int, last_error, last_synced_at)                         UNIQUE(session_id, user_id)

youtube_videos      (video_id unique, title, published_at, thumbnail_url, duration,
                     view_count, like_count, comment_count, stats_updated_at,
                     backfill_state enum['untagged','tagged','ignored'])
video_stats_history (video_id, captured_on date, view_count, like_count, comment_count)  UNIQUE(video_id, captured_on)

notifications       (user_id, type, payload jsonb, read_at)
app_settings        (single row: youtube_channel_id, sync_time_sgt time, default_practice_minutes,
                     default_filming_minutes, avail_window_start time, avail_window_end time,
                     lookahead_weeks, default_timezone, last_youtube_sync_at, last_tick_at)
session_reminders   (session_id, user_id, sent_at)                                    UNIQUE(session_id, user_id)
sync_runs           (kind, started_at, finished_at, ok bool, summary jsonb)
```

---

## 6. Security & Privacy

- **SEC-1 Authorization layer (replaces RLS):**
  - All database access goes through `src/server/**` modules marked `import "server-only"`. Client components never import the DB client.
  - Guards, in `src/server/auth-guards.ts`:
    - `requireActiveUser()`: throws or redirects unless the session user has `status = 'active'`
    - `requireAdmin()`
    - `requireSongEditor(songId)`: the user is an IC of the song, or an admin
    - `requireSelf(userId)`
  - Every Server Action and Route Handler calls the right guard first, then validates its input with Zod.
  - `middleware.ts` redirects unauthenticated users to `/login`, and users who aren't active to `/pending`. Middleware is for UX only; the guards are what enforce security.
  - Write-permission summary: songs, positions, assignments, invitations and sessions → `requireSongEditor`. Members edit only their own profile, overrides, calendars and RSVPs. An invitee may only respond to their own invitation.
- **SEC-2 Token handling:** Google tokens are encrypted at rest (FR-AUTH-3) and never sent to the client. The session object exposes only `id`, `name`, `image`, `system_role` and `status`.
- **SEC-3 Calendar privacy:** other members see only **busy/free intervals**, never calendar event titles or details, and the app never stores them.
- **SEC-4 Secrets:** all secrets live in Vercel environment variables. `/api/cron/*` requires `Authorization: Bearer ${CRON_SECRET}`.
- **SEC-5 Disconnect:** a member can disconnect Google Calendar from their settings. This revokes the token with Google, clears the token columns and stops calendar writes. Existing events stay unless they choose "Remove RepresENT events".
- **SEC-6 Mutations:** Server Actions get built-in CSRF protection from Next.js. Any custom POST route handlers check the session and `Origin`.
- **SEC-7 Public repository:** the source code is public, so:
  - **Never commit secrets.** `.env*` is in `.gitignore` except `.env.example`, which holds variable names only. Secrets live only in Vercel and GitHub Actions secrets.
  - Enable **GitHub secret scanning + push protection** and **Dependabot** alerts on the repo.
  - Seed data and fixtures use **fictional** members only. No real names, emails or calendar data in the repo, issues or commit messages.
  - Security must never depend on the code being hidden: all protection comes from auth guards, `CRON_SECRET` and the encryption key.
  - GitHub Actions workflows that use secrets run only on `schedule`/`workflow_dispatch` and `push` to `main`, never on `pull_request` from forks.
  - Add a `LICENSE` (the RepresENT admins choose which) and a `SECURITY.md` with a contact for reporting vulnerabilities.

---

## 7. Server Jobs & Endpoints

| Endpoint / module | Trigger | Purpose |
|---|---|---|
| `src/server/google.ts` → `googleClient(userId)` | Internal | Decrypt tokens, refresh when expired, save the new access token, set `token_error` on `invalid_grant`. |
| `GET /api/avails` | Client (avails views) | Merged busy intervals for the requested members (Google + overrides − RepresENT sessions), with caching. Requires an active user. |
| `src/server/calendar-sync.ts` → `syncSessionCalendars(sessionId)` | After session or assignment changes (`after()`), and retries | Create, update or delete Google events for the affected members. |
| `src/server/youtube-sync.ts` → `runYoutubeSync()` | `cron/tick` when due, admin "Sync now" | Import new uploads, refresh stats, write snapshots, log to `sync_runs`. |
| `POST /api/cron/tick` | GitHub Actions hourly, Vercel cron daily (fallback) | 1) YouTube sync if the daily sync time has passed and it hasn't run today; 2) RSVP-needed notifications for sessions within 24 h; 3) retry failed calendar syncs (fewer than 3 attempts); 4) prune stale `freebusy_cache`. Must be idempotent and finish within function limits. |

---

## 8. Non-Functional Requirements

- **NFR-1 Responsive:** mobile-first. Layouts must work at 360 px, 768 px and ≥1280 px. Navigation is a bottom tab bar on mobile and a sidebar on desktop. Avails grids become day lists on small screens. Tap targets are at least 44 px.
- **NFR-2 Performance:** first load on 4G under 3 s (excluding a Neon cold start). Use Server Components by default. Stream with `loading.tsx` skeletons. Lazy-load the charts library.
- **NFR-3 Accessibility:** WCAG 2.1 AA contrast on the dark theme. Full keyboard navigation. Status is never conveyed by colour alone (for example, the unavailable flag uses an icon plus a label).
- **NFR-4 Reliability:** Google API failures never block saving data in the app. Calendar writes retry with backoff, up to 3 attempts. All cron work is idempotent.
- **NFR-5 Cost:** stay within free tiers (Vercel Hobby, Neon Free, GitHub Actions free minutes, Google API free quotas).
- **NFR-6 Maintainability:** TypeScript strict mode. Drizzle schema is the single source of truth, with `drizzle-kit generate` + `migrate`. Include a seed script (`pnpm db:seed`) with sample groups, members, songs and videos. ESLint + Prettier.
- **NFR-7 Environments:** use a Neon **branch** for development and preview deployments, separate from the production branch.
- **NFR-8 PWA (optional):** installable manifest and icons so members can add the app to their home screen.

---

## 9. UI / UX

### 9.1 Visual style
- **Bold dark K-pop style:** near-black background (`#0B0B10`-ish) with vibrant accents (for example, a hot pink primary and an electric violet/cyan secondary), plus glow or gradient highlights on key actions.
- Image-heavy cards using YouTube thumbnails and group images (`next/image` with `i.ytimg.com` allowed in `remotePatterns`). Rounded corners, subtle glass/blur surfaces.
- Typography via `next/font`: a bold display font for headings (such as "Space Grotesk" or "Outfit") and "Inter" for body text.
- Status chips have consistent colours: Recruiting, Practising, Filming, Editing, Posted, Cancelled.
- Keep the RepresENT logo as a placeholder asset (`/public/logo.svg`) that is easy to replace.

### 9.2 Routes (App Router)
```
app/(public)/login             Google sign-in
app/(public)/pending           Awaiting approval / rejected screen
app/(app)/onboarding           Profile + calendar selection
app/(app)/                     Dashboard (stats + upcoming)
app/(app)/catalogue            All posted covers
app/(app)/songs/new            Start a song crew
app/(app)/songs/[id]           Song detail (tabs: Overview · Crew · Schedule · Avails · Video)
app/(app)/songs/[id]/sessions/[sid]   Practice / filming detail (flags, RSVPs)
app/(app)/my-songs             Member history
app/(app)/availability         My availability (week view + overrides)
app/(app)/members/[id]         Member profile
app/(app)/notifications        Notifications
app/(app)/admin/approvals      Pending signups
app/(app)/admin/members        Member management
app/(app)/admin/groups         Idol groups & rosters (+ requests)
app/(app)/admin/backfill       Untagged YouTube videos
app/(app)/admin/settings       System settings + sync status
app/api/auth/[...nextauth]     Auth.js
app/api/avails                 Free/busy endpoint
app/api/cron/tick              Scheduled jobs
```

---

## 10. Build Plan (suggested milestones)

1. **Foundation:**
   - Next.js scaffold with Tailwind and shadcn/ui
   - Neon + Drizzle schema for auth, users and settings
   - Auth.js Google sign-in with encrypted tokens
   - pending/approval flow and auth guards
   - admin approvals page
   - dark-theme shell with responsive nav
   - deploy to Vercel
2. **Groups & songs:** idol groups and rosters admin, guests, song creation with prefilled positions, invitations, crew management, in-app notifications with polling.
3. **YouTube:** settings, `runYoutubeSync`, `cron/tick` + GitHub Actions workflow, catalogue, linking videos to songs, backfill queue.
4. **History & dashboard:** My Songs, `getMemberDashboard`, dashboard charts, member profiles.
5. **Calendar read:** calendar selection, `/api/avails` with caching, manual overrides, My Availability, IC crew avails heatmap, suggested slots.
6. **Sessions & calendar write:** practices and filming, unavailable flagging, RSVPs, `syncSessionCalendars` with retries, RSVP reminders.
7. **Polish:** responsive QA, accessibility, error and empty states, optional PWA, a deployment README (Google Cloud OAuth setup, publishing to production, environment variables, enabling the GitHub Actions cron and keepalive).

> **Milestone 1 also includes public-repo hygiene:** `.gitignore`, `.env.example`, secret scanning and push protection, Dependabot, `LICENSE` and `SECURITY.md`. Do this **before the first push**.

---

## 11. Acceptance Criteria (key scenarios)

- **AC-1:** A new Google user sees only the pending screen. Calling any Server Action or API route directly returns 403. An admin approves them, and on refresh they reach onboarding and then the dashboard.
- **AC-2:** An IC creates a NewJeans song. All 5 active members are prefilled; the IC unticks one, adds a custom "Center" slot, invites 3 members and assigns 1 guest. The invitees get notifications. Accepted invitees appear in the crew; declined slots revert to Unfilled.
- **AC-3:** An admin adds a new idol member to a group. New songs for that group include the new slot; existing songs are unchanged.
- **AC-4:** A member with a Google event 7–9 pm is flagged **Unavailable** for a 8–10 pm practice. After they add a manual "Free" override for that time, they show as Available.
- **AC-5:** Creating a practice puts an event in every crew member's Google Calendar. Editing its time updates all of them, and cancelling deletes them. The member's own RepresENT practice does not mark them busy. With one member's token revoked, the practice still saves and the IC sees a failure notice.
- **AC-6:** After `cron/tick` runs past the sync time, a new channel upload appears in the backfill/link list. Once it is linked to a song, the song shows as Posted in the catalogue with views, likes and comments. Calling `cron/tick` twice in a row does not create duplicate snapshots or notifications.
- **AC-7:** A member who danced in 3 girl-group covers and edited 1 boy-group cover this year sees "3 songs covered, 3 girl / 0 boy". The edited song appears in My Songs but not in the stats.
- **AC-8:** All pages are usable at 360 px wide, with no horizontal scrolling except on intentionally scrollable grids.
- **AC-9:** `/api/cron/tick` without the correct bearer token returns 401.
- **AC-10:** The public repo contains no secrets or real member data. Pushing a file with a fake API key is blocked by push protection.
- **AC-11:** If ticks stop for more than 3 hours, admins see the stalled-jobs warning. When ticks resume, every overdue reminder is sent exactly once.

---

## 12. Out of Scope (v1)
- Email, Telegram or push notifications (in-app only for v1)
- Real-time websockets (polling is enough)
- Attendance tracking (present/late/absent): RSVP only
- Uploading or hosting videos; editing workflow tools
- Multiple YouTube channels
- Public (non-member) access to the catalogue
- Payments or studio booking integrations

---

## 13. Assumptions & Open Questions
| # | Item | Current assumption |
|---|---|---|
| A1 | Who sees the catalogue? | Members only (logged in and active). |
| A2 | Song status changes | Manual by IC; `Posted` requires a linked video. |
| A3 | Calendar events go to | Each member's **primary** calendar. |
| A4 | Most-covered idol member | Counts only positions mapped to an idol member, not custom slots. |
| A5 | Year for stats | Video `published_at` year in Asia/Singapore time. |
| A6 | Can members add guests? | Yes; admins can edit or merge duplicates. |
| A7 | Can ICs edit the roster directly? | No. Only admins can; ICs can request a group, or use custom positions meanwhile. |
| A8 | Non-cover uploads on the channel | Admins mark them "ignored" in the backfill queue. |
| A9 | Repo visibility | **Public** GitHub repo (needed for free Vercel deploys from an organization repo). Covered by SEC-7 and the §2.1 keepalive. |
| Q1 | Should guests ever be able to claim/link a member account later? | Not in v1. |