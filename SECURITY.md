# Security policy

This repository is public, but the RepresENT Portal's security does not depend on the code being hidden. Access is protected by server-side authorization guards, Google sign-in with admin approval, an encrypted token store and a secret-protected cron endpoint.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository, or contact a RepresENT admin directly.

Include steps to reproduce and the impact you think it has. We aim to reply within a week.

## Scope

- The deployed portal and this source code.
- Out of scope: Google, Vercel and Neon themselves, and social-engineering of members.

## For maintainers

- Secrets live only in Vercel and GitHub Actions secrets. `.env*` is gitignored except `.env.example`.
- Keep GitHub secret scanning, push protection and Dependabot alerts enabled.
- Seed data and fixtures must stay fictional: no real member names, emails or calendar data.
