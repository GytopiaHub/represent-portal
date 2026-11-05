This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup

### Environment (`.env`)

| Variable | What |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Auth.js secret — `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 key encrypting Google tokens at rest — `openssl rand -base64 32`. Changing it makes stored tokens unreadable (everyone must reconnect). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client |

### Google OAuth client

1. Google Cloud Console → enable the **Google Calendar API**.
2. OAuth consent screen: add scopes `calendar.readonly` and `calendar.events`. While the app is unverified, users see an "unverified app" warning (explained on the login and onboarding screens).
3. Credentials → OAuth client ID (Web application). Authorised redirect URI:
   `http://localhost:3000/api/auth/callback/google` (plus your production URL).

### Database

`npm run db:reset` drops everything and recreates the schema from `db/schema.ts`.
The **first person to sign in** on an empty database becomes the admin; everyone after that waits for approval.

## Auth overview

- `auth.ts` — Auth.js (Google + Drizzle adapter, database sessions). Encrypts tokens in `linkAccount`, bootstraps the first admin in `events.createUser`, refreshes stored tokens on later sign-ins.
- `proxy.ts` — redirects users to the right screen for their status (Next 16's replacement for `middleware.ts`).
- `lib/dal.ts` — `requireUser` / `requireActiveUser` / `requireAdmin`. **Every** data function (`lib/data.ts`) and Server Action (`lib/actions.ts`) calls one of these; the proxy is not the only guard.
- `lib/google.ts` — `googleClient(userId)`: the only code that decrypts tokens; refreshes expired access tokens and flags `accounts.token_error` on `invalid_grant`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
