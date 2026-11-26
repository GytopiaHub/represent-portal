# Security policy

This repository is public, but the RepresENT Portal's security does not depend on the code being hidden. All database access is server-side only, and secrets live only in environment variables. Members sign in with Google, and only Google accounts on the admin and member email lists (held in environment variables) are let in.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository, or contact a RepresENT admin directly.

Include steps to reproduce and the impact you think it has. We aim to reply within a week.

## Scope

- The deployed portal and this source code.
- Out of scope: Google, Vercel and Neon themselves, and social-engineering of members.

## For maintainers

- Secrets live only in Vercel environment variables (and GitHub Actions secrets, if a workflow needs one). `.env*` is gitignored except `.env.example`.
- Keep GitHub secret scanning, push protection and Dependabot alerts enabled.
- Seed data and fixtures must stay fictional: no real member names, emails or personal data.
