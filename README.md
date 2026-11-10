# RepresENT Portal

Crew portal for RepresENT, a K-pop dance cover crew. The code has been reset to its foundation, and features are being rebuilt one at a time. The spec is [docs/SRS.md](docs/SRS.md).

Stack: Next.js 16 (App Router, Cache Components) · Neon Postgres · Drizzle · Tailwind + shadcn/ui. Auth (Google OAuth) is deferred.

## Quick start

```bash
cp .env.example .env      # fill in DATABASE_URL (Neon)
npm install
npm run db:reset          # drops every table and enum, then pushes the schema (destructive)
npm run dev
```

## Environment

Only `DATABASE_URL` is needed. See [.env.example](.env.example). In production, set it in Vercel.

## Project structure

```
src/
  app/                 routing only; keep pages thin
  features/<domain>/   UI for one domain (added as features are rebuilt)
  components/          shared UI: ui/ (shadcn, via `npx shadcn add`), layout/, common/
  server/              the only code that touches the database (SEC-1)
  db/                  Drizzle client and schema/ (one file per domain)
  lib/                 framework-free helpers usable anywhere
scripts/               db:reset
docs/                  SRS.md (requirements); ui/<page>.html: UI options per page
```

Imports only point down: `app → features → components, lib` and `app, features → server → db, lib`. ESLint enforces this (`eslint.config.mjs`). Type-only imports are always allowed.

### Adding a feature

1. Specify it in `docs/SRS.md`.
2. Tables go in `src/db/schema/<domain>.ts`, re-exported from `schema/index.ts`.
3. Add `src/server/<domain>/queries.ts` and `actions.ts`.
4. Add UI in `src/features/<domain>/components/`.
5. Add the route under `src/app/`.

Scripts: `db:reset` (drop everything, then push the schema), `db:studio`.
