# RepresENT Portal: instructions for Claude

A members-only portal for RepresENT, a K-pop dance cover crew. Built with Next.js (App Router), Neon Postgres, Drizzle, Auth.js v5 and Tailwind/shadcn, and deployed on Vercel's free tier. Gene owns the repo and approves all changes.

@../AGENTS.md

## Ground rules (always apply)

1. **Plan first, then wait for approval.** Never edit files until Gene has approved a plan. See `.claude/rules/workflow.md`.
2. **Code, SRS and README stay aligned.** Any change that affects behaviour, structure, setup or requirements also updates `docs/SRS.md` and `README.md` in the same piece of work. See `.claude/rules/docs-sync.md`.
3. **Check the docs, don't guess.** This Next.js version differs from older ones. Read the bundled docs in `node_modules/next/dist/docs/` before writing Next.js code. For other libraries, or anything unclear, search the official docs online and cite them in the plan.

## Sources of truth

| Topic | File |
| --- | --- |
| What the app must do: requirements, data model, security, routes | `docs/SRS.md` (§13 records assumptions and decisions) |
| How to run, set up and navigate the code | `README.md` ("Project structure" describes the layering) |
| Database schema | `src/db/schema/*.ts` (re-exported by `index.ts`) |

If the code and the SRS disagree, don't silently choose one. Raise it in the plan.

## Architecture in one breath

`src/app` handles routing only. `src/features/<domain>` holds the UI for one domain. `src/components` holds shared UI. `src/server` is the **only** code that touches the database: each domain has `queries.ts` (guarded reads), `actions.ts` (`"use server"`: guard → Zod → write) and internal helpers. `src/db` holds the schema. `src/lib` holds pure helpers. Imports only point down, and `eslint.config.mjs` enforces this.

- Every Server Action and Route Handler calls a guard from `src/server/auth-guards.ts` first. `proxy.ts` is for UX only.
- Never export a helper from an `actions.ts`, because every export there becomes a public endpoint.
- Google tokens are decrypted only in `src/server/google.ts`.

## Environment and commands

- The repo lives in WSL. Run Node tooling inside WSL, not with Windows Node: `wsl.exe -e bash -ic "cd ~/represent/represent-portal && <cmd>"`.
- Typecheck: `npx tsc --noEmit -p .`. Build: `npx next build`. Route types: `npx next typegen`.
- Lint: `npm run lint`. It's currently broken: `package.json` pins an unrelated `eslint-config-next@^0.2.4` instead of the version matching `next`.
- DB: `npm run db:seed`, `npm run db:studio`. **`npm run db:reset` is destructive; ask Gene to run it.**
- Google Calendar and YouTube are mocked by default (`GOOGLE_APIS=mock`). Sign-in is real.

## Public repo rules (SRS §6, SEC-7)

- Never commit secrets or real member data. Seed data and fixtures are fictional.
- Don't commit, push or open PRs unless Gene asks. Work on a branch, not `main`.
