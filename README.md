# RepresENT Portal

Crew portal for RepresENT, a K-pop dance cover crew. The code has been reset to its foundation, and features are being rebuilt one at a time. The spec is [docs/SRS.md](docs/SRS.md).

Stack: Next.js 16 (App Router, Cache Components) · Neon Postgres · Drizzle · Better Auth (Google sign-in) · Tailwind + shadcn/ui.

## Quick start

```bash
cp .env.example .env      # fill in DATABASE_URL and the YouTube vars
npm install
npm run db:reset          # drops every table and enum, then pushes the schema (destructive)
npm run db:seed           # loads reference data (groups and members); safe to re-run
npm run dev
```

## Environment

`DATABASE_URL` (Neon), `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_HANDLE` (the home page channel dashboard), and the sign-in variables below. See [.env.example](.env.example) and SRS section 2.2. In production, set them in Vercel.

### Google sign-in

1. In Google Cloud Console, create an OAuth client of type Web application. Add the redirect URI `http://localhost:3000/api/auth/callback/google`, plus `https://<your-domain>/api/auth/callback/google` for production.
2. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
3. List who may sign in: `ADMIN_EMAILS` and `MEMBER_EMAILS`, comma-separated Google emails. Anyone on neither list is refused (SRS 6.4).

## Project structure

```
src/
  app/                 routing only; keep pages thin
  features/<domain>/   UI for one domain (added as features are rebuilt)
  components/          shared UI: ui/ (shadcn, via `npx shadcn add`), layout/, common/
  server/              the only code that touches the database or secret-keyed APIs (SEC-1)
  db/                  Drizzle client, schema/ (one file per domain) and seed/ (reference data)
  lib/                 framework-free helpers usable anywhere
scripts/               db:reset, db:seed
docs/                  SRS.md (requirements); ui/<page>.html: UI options per page
```

Imports only point down: `app → features → components, lib` and `app, features → server → db, lib`. ESLint enforces this (`eslint.config.mjs`). Type-only imports are always allowed.

### Adding a feature

1. Specify it in `docs/SRS.md`.
2. Tables go in `src/db/schema/<domain>.ts`, re-exported from `schema/index.ts`.
3. Add `src/server/<domain>/queries.ts` and `actions.ts`.
4. Add UI in `src/features/<domain>/components/`.
5. Add the route under `src/app/`.

Scripts: `db:reset` (drop everything, then push the schema), `db:seed` (load reference data, safe to re-run), `db:studio`.
