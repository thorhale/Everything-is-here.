# Hosting decision (M8)

## The deciding constraint: database size

Measured locally: 69MB of Postgres at 19,523 recipes → the full 354,608-recipe
archive projects to **~1.25GB** (plus index growth for full-text search).
That single number eliminates most of the famous free tiers:

| Option | Free DB limit | Verdict |
|---|---|---|
| Neon free | 512MB | Too small for the full archive |
| Supabase free | 500MB | Too small |
| Render free Postgres | Expires after 30 days | Non-starter |
| Railway | Trial credit only, no free tier | Non-starter |
| Fly.io | No true free tier anymore | Non-starter |
| Cloudflare D1 / Turso (SQLite) | 5GB | Fits, but needs Prisma driver adapters + a different Next.js deployment path — too much friction for this project |
| **Aiven free Postgres** | **5GB, 1 vCPU, 1GB RAM** | **Fits the full archive with headroom** |

## Decision

- **App**: Vercel Hobby (free) — first-class Next.js hosting, zero config for
  this repo's `app/` directory. Hobby tier is for non-commercial projects,
  which a free community archive is.
- **Database**: Aiven free PostgreSQL (5GB) — the only well-known,
  non-expiring free Postgres that fits ~1.25GB. Standard `DATABASE_URL`
  connection string, so Prisma needs no code changes.

> **Verify before signup** (couldn't confirm from the sandbox at decision
> time): that Aiven's free plan still offers these specs. If it has changed,
> the fallbacks below apply.

## Fallbacks, in order

1. **Two-phase launch on Neon free (512MB)**: launch now with the ~140k
   highest-quality recipes (512MB ÷ ~3.5KB/recipe), marked "more being
   restored", and migrate to a bigger DB later. Nothing about the app
   changes — only which rows get imported.
2. **Cheap paid Postgres** (~$5/mo range: Neon Launch, Supabase Pro,
   DigitalOcean managed PG) if truly-free-at-full-scale stops being possible.

## Deployment steps (when ready)

1. Merge this branch to main so Vercel can deploy from it.
2. Sign up at aiven.io → create a free PostgreSQL service → copy the
   `DATABASE_URL` connection string.
3. Sign up at vercel.com with GitHub → import this repo → set root directory
   to `app/` → add env vars `DATABASE_URL` (from Aiven) and `ADMIN_TOKEN`
   (any long random string; gates /admin/takedowns until real auth lands).
4. Load schema + data into the Aiven DB from any machine with this repo:
   `cd app && npx prisma migrate deploy && npx tsx prisma/import.ts
   ../data/parsed/recipes_full.jsonl` (gunzip `data/snapshots/` first if the
   live scrape file isn't at hand).
5. Before announcing publicly: replace the ADMIN_TOKEN query-string gate with
   real auth (flagged in app/app/admin/takedowns/page.tsx).
