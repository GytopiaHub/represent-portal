# RepresENT Portal — Software Requirements Specification

**Version:** 2.1 · **Date:** 2026-11-13 · **Audience:** Claude (implementation agent) and RepresENT admins

> **Changelog**
> - **v2.1:** Added the channel dashboard (section 6.1) as the home page, fed by the YouTube Data API. Added `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_HANDLE`. UI option C chosen in `docs/ui/home.html`.
> - **v2.0:** Reset the code to its foundation so features can be rebuilt and re-specified one at a time. This document now covers only the architecture. Feature requirements (roles, functional requirements, data model, jobs, routes, build plan, acceptance criteria) were removed, and each one is added back as its feature is rebuilt. Google OAuth (Auth.js) is deferred and will be added later. The only environment variable is the Neon connection string. The full v1.4 spec is in git history at `ed5875a`.
> - **v1.4:** Added `docs/ui/`, which holds one HTML page of UI options per app page.
> - **v1.3:** Added read-only **Visitor** access for people who aren't signed in.
> - **v1.2:** The GitHub repo is **public**, so Vercel Hobby can deploy it. Added public-repo rules.
> - **v1.1:** Stack changed from Vite + React + Supabase to **Next.js (App Router) + Neon Postgres + Drizzle ORM** on Vercel. Authorization moved from Postgres RLS to a server-side authorization layer.
> - **v1.0:** Initial spec.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for the **RepresENT Portal**, a web app for RepresENT, a K-pop dance cover crew. It is the source of truth for building the app. When anything is unclear, follow this document and record the decision here.

### 1.2 Product summary
A crew portal where members run song covers (crews, recruiting, scheduling), browse the cover catalogue and see their own history and stats. Features are being rebuilt one at a time, and each is specified in this document as it is rebuilt.

### 1.3 Scale & constraints
- **Users:** fewer than 30 members (this is a design assumption, not a hard cap).
- **Cost:** must run entirely on **free tiers**.
- **Default time zone:** `Asia/Singapore`. Store all times in UTC and display them in the user's local time zone.
- **Devices:** fully responsive. Mobile-first, because most members will use phones.

---

## 2. Technology & Hosting

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server Components for reads. Server Actions for mutations. Route Handlers (`app/api/**`) for JSON endpoints. |
| Database | **Neon Postgres** (Free plan) | `@neondatabase/serverless` driver. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Schema lives in `src/db/schema/` (one file per domain, re-exported from `index.ts`). |
| Auth | **Deferred** | Google OAuth will be added later. Until then the app has no sign-in. |
| Validation | **Zod** | Validate every Server Action and Route Handler input. Install it with the first feature that takes input. |
| UI | Tailwind CSS + shadcn/ui | Add components with `npx shadcn add <name>` as features need them. |
| Client data | Server Components + `revalidatePath`/`revalidateTag` | |
| Hosting | **Vercel Hobby** (free) | Personal, non-commercial use fits Hobby terms. |

### 2.1 Free-tier considerations (must handle)
1. **Neon scale-to-zero:** compute suspends after 5 minutes idle. The first request after that adds a short cold-start delay. This is acceptable; show loading skeletons. Never store images or video in the database; store URLs only.
2. **Vercel Hobby:** functions have execution time limits. Keep each request's work short.

### 2.2 Environment variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string. |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key. Server only; never sent to the browser or put in a URL. Restrict it to the YouTube Data API v3 in Google Cloud Console. |
| `YOUTUBE_CHANNEL_HANDLE` | Handle of the channel the dashboard reports on, e.g. `@Repres_ENT`. Resolved to the channel ID at runtime. If the handle is renamed on YouTube, update this. |

---

## 3. Security & Privacy

- **SEC-1 Data access layer:** all database access, and every call to a third-party API that needs a secret, goes through `src/server/**` (files there import `server-only`). Client components never import the DB client. ESLint enforces the import layering (`eslint.config.mjs`). Authorization guards are added with auth.
- **SEC-2 Secrets:** all secrets live in environment variables (Vercel in production, `.env` locally), never in code.
- **SEC-3 Mutations:** Server Actions get built-in CSRF protection from Next.js. Any custom POST route handlers check `Origin`.
- **SEC-4 Public repository:** the source code is public, so:
  - **Never commit secrets.** `.env*` is in `.gitignore` except `.env.example`, which holds variable names only.
  - Enable **GitHub secret scanning + push protection** and **Dependabot** alerts on the repo.
  - Seed data and fixtures use **fictional** people only. No real names, emails or personal data in the repo, issues or commit messages.
  - Security must never depend on the code being hidden.
  - GitHub Actions workflows that use secrets run only on `schedule`/`workflow_dispatch` and `push` to `main`, never on `pull_request` from forks.
  - Keep a `SECURITY.md` with a contact for reporting vulnerabilities.

---

## 4. Non-Functional Requirements

- **NFR-1 Responsive:** mobile-first. Layouts must work at 360 px, 768 px and ≥1280 px. Tap targets are at least 44 px.
- **NFR-2 Performance:** first load on 4G under 3 s (excluding a Neon cold start). Use Server Components by default. Stream with `loading.tsx` skeletons. Lazy-load heavy client libraries.
- **NFR-3 Accessibility:** WCAG 2.1 AA contrast on the dark theme. Full keyboard navigation. Status is never conveyed by colour alone.
- **NFR-4 Reliability:** third-party API failures never block saving data in the app. Background work is idempotent.
- **NFR-5 Cost:** stay within free tiers (Vercel Hobby, Neon Free).
- **NFR-6 Maintainability:** TypeScript strict mode. The Drizzle schema is the single source of truth. ESLint.
- **NFR-7 Environments:** use a Neon **branch** for development and preview deployments, separate from the production branch.

---

## 5. UI / UX

### 5.1 Visual style
- **Stock styles for now:** the app uses the default shadcn/ui neutral theme in dark mode only, with no custom colours, gradients or decorative utilities. The logo is the only coloured element. The visual design is a later phase, once the core app works. Tokens are in `src/app/globals.css`.
- Typography via `next/font`: "Inter" for all text.
- Keep the RepresENT logo as a placeholder asset (`/public/logo.svg`) that is easy to replace.
- **UI options:** before a new page or a redesign is built, it gets a self-contained `docs/ui/<page>.html` showing three options (**A**, **B**, **C**), each viewable at phone and desktop width. The chosen option is marked with a "Chosen" badge and date, and the files stay in the repo for reference.

### 5.2 Routes (App Router)
```
app/page.tsx       Channel dashboard (6.1)
```

---

## 6. Features

### 6.1 Channel dashboard (home page)

A page members open to check how the RepresENT YouTube channel is doing. Public while sign-in is deferred; every figure on it is already public on YouTube.

**Layout:** option C in `docs/ui/home.html`. Two tabs:

- **Overview:** subscriber count as the headline figure, with total views and video count under it. Tiles for days since the last upload, uploads this calendar year and median views per video. An uploads-per-month column chart for the last 12 months (with a table view). The 5 most recent uploads with views, likes and comments.
- **Videos:** every public upload as a card (thumbnail, title, date, length, views, likes) with search by title and sort by newest, oldest, most viewed or most liked. Search and sort run in the browser. Each video links to YouTube.

The page shows when the data was fetched, in the viewer's local time.

**Data source** (`src/server/youtube/queries.ts`, YouTube Data API v3):

1. `channels.list?forHandle=` resolves the handle to the uploads playlist and returns subscribers, views and video count (1 unit).
2. `playlistItems.list` pages through the uploads playlist, 50 per page (1 unit per page).
3. `videos.list` fetches snippet, duration and statistics in batches of 50 (1 unit per batch). Private and deleted uploads drop out here.

About 7 units per refresh at 133 videos, against the free 10,000 units a day.

**Derived figures** (`src/lib/channel-stats.ts`) are measured from the fetch time, not the request time, so they always match the cached data. Months and years are bucketed in `Asia/Singapore`.

**Caching:** the whole fetch is one `"use cache"` function keyed by the handle. Success uses `cacheLife("hours")` (revalidate hourly, expire after a day); errors use `cacheLife("minutes")` so an outage clears quickly. The route prerenders as static with hourly revalidation.

**Failure handling (NFR-4):** if the env vars are missing, the handle matches no channel, or the API fails, the page renders a short message in place of the data instead of an error page. API errors are logged with status and reason only.

**Not yet covered:** subscriber and view history. The Data API only returns current totals, so growth charts need a daily snapshot saved to Neon (for example by a Vercel cron job), or the YouTube Analytics API with the channel owner's OAuth consent.
