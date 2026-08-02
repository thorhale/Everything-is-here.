# User accounts (Google / Apple sign-in)

The app has passwordless sign-in via Auth.js (NextAuth v5). Google and Apple
providers are wired but **switched off until their credentials are set** — the
sign-in page says so, and the buttons appear automatically once the environment
variables below exist. Nothing here requires a password.

## Design choices worth knowing

- **JWT sessions, not database sessions.** The session lives in a signed
  cookie, so an authenticated request costs no database query. The Prisma
  adapter still writes a `User` + `Account` row, but only at sign-in. This is
  the same discipline that took the calculators off the database — it matters
  on the free-tier database.
- **Separate from the admin gate.** `lib/admin-auth.ts` (the takedown queue) is
  unchanged and unrelated. These are end-user accounts.
- **Separate from the archive.** The `Brewer` rows are scraped BrewToad
  authors, not app users. The new `User` table is the app's own accounts.

## One-time setup

### 1. Signing secret and URL
```bash
openssl rand -base64 33   # value for AUTH_SECRET
```
Set `AUTH_SECRET` and `AUTH_URL` (the deployment's public URL) in the
environment.

### 2. Create the database tables
Port 5432 is blocked in the cloud container, so apply the tables over the Neon
HTTP driver (same pattern as the data loaders):
```bash
cd app && node --env-file=.neon.env create-auth-tables.mjs
```
This is idempotent (`CREATE ... IF NOT EXISTS`) and creates `User`, `Account`,
`Session`, `VerificationToken`. On a machine with direct database access,
`prisma migrate dev` does the same from `prisma/schema.prisma`.

### 3. Google
1. <https://console.cloud.google.com/apis/credentials> → **Create OAuth client
   ID** → Web application.
2. Authorized redirect URI: `<AUTH_URL>/api/auth/callback/google`
3. Put the client id/secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### 4. Apple (more involved)
1. <https://developer.apple.com> (requires the $99/yr Apple Developer Program).
   Enable **Sign in with Apple** on an App ID, create a Services ID, and add the
   redirect URI `<AUTH_URL>/api/auth/callback/apple`.
2. `AUTH_APPLE_ID` is the Services ID. `AUTH_APPLE_SECRET` is a **JWT you
   generate** from your Apple private key (`.p8`). Apple caps its lifetime at
   ~6 months, so it must be regenerated on a schedule — a real operational
   gotcha, not a set-and-forget value.

Note: the App Store separately *requires* Sign in with Apple to be offered if
any other third-party sign-in (like Google) is, so both matter for the native
app, not just Google.

## What exists now vs. next

- **Now:** sign in / sign out, a persisted `User` record, the account page.
- **Next:** hanging saved recipes and brew logs off `User.id` — the reason the
  accounts exist. That is a new feature on top of this foundation, not part of
  it.
