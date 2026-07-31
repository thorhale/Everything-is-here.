# What WortHogg costs to operate

Honest numbers for running this as a **commercial** (monetized) app. Prices
verified July 2026 against Vercel and Neon; treat them as ballparks and
re-check before committing money. The short version is at the bottom.

## The unavoidable floor

These are fixed and cannot be engineered away for a store app:

| Item | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | **$99 / year** | Mandatory to ship on iOS. No way around it. |
| Google Play Console | **$25 once** | One-time registration. |
| Domain | ~$12 / year | Optional but expected. |

So **~$110 in year one** before a single server bill. That is the real "it
will cost *something*" answer — there is no $0 path to a commercial iOS app.

## The one that surprises people: Vercel Hobby is non-commercial

The app is deployed on Vercel's **Hobby** (free) plan today. Vercel's terms
**prohibit commercial use on Hobby** — the moment the app is monetized, you
must move to **Pro at $20/developer/month**, or move off Vercel. This single
rule is the biggest lever in the whole cost picture, and it is a licensing
line, not a technical limit.

## Three ways to host it

The architecture we built is ~90% static: the calculators are prerendered and
run offline, sessions are JWT (no per-request database read), and the catalog
pages are cached. That makes hosting cheap on any of these paths, because most
traffic is served from a CDN at effectively zero marginal cost.

### Path A — Managed (Vercel Pro + Neon)
- Vercel Pro: **$20/mo** (required once commercial; includes $20 of credits).
- Neon Launch: **usage-based, no monthly minimum** — $0.35/GB-month storage
  + $0.106/CU-hour compute. For this workload (tiny DB, mostly static, JWT
  sessions) realistically **$1–10/mo**.
- **≈ $21–30/mo + $99/yr Apple → roughly $350–460/year.**
- Zero ops. Autoscaling. The safe default if your time is worth more than the
  difference.

### Path B — Self-host on a VPS (your question)
One small virtual server runs the whole stack: the Next.js app (Node), Postgres,
and Caddy for automatic HTTPS, all on one box.
- Hetzner CX22 (2 vCPU / 4 GB): **~€4.50/mo (~$5)**. DigitalOcean/Linode
  equivalents are $6–12/mo.
- Postgres self-hosted on the same box: **$0 extra** — the 368 MB database is
  trivial, and a VPS this size handles this app's load with room to spare.
- Backups (object storage or a Hetzner storage box): **~$1–5/mo**.
- **≈ $6–15/mo + $99/yr Apple → roughly $180–280/year.**
- The catch is **you own operations**: OS patching, security, backups,
  uptime, and there is no autoscaling. If it falls over at 2 a.m., that is
  your night. For a solo operator that time cost is real and easy to
  under-price.

### Path C — Near-zero opex (recommended if the app ships without the archive)
This is the closest thing to "won't cost money to operate," and it depends on
one product decision we already flagged for IP reasons: **ship the store app
as tools + curated data, without the 118k scraped-recipe archive.**

Without the archive, almost nothing needs a server:
- All reference data (ingredients, water, yeast, guidelines) is already baked
  into the bundle — static.
- The calculators are static and offline.
- The only dynamic parts left are user accounts and saved recipes — a *tiny*
  amount of data.

That app can be hosted on **Cloudflare Pages**, whose free tier **permits
commercial use** (unlike Vercel Hobby) and serves unlimited static requests at
no cost, with user data in a small database (Neon's free tier may even suffice,
since the heavy reference data is no longer in it).
- **≈ $0/mo hosting + $99/yr Apple → roughly $110/year, essentially all fixed
  fees.**
- Trade-off: giving up the archive (an SEO/discovery asset) and doing the work
  to split the dynamic bits onto Cloudflare's model (Workers/D1 or an external
  Postgres).

## Economies of scale — the honest shape

There is scale efficiency here, but it comes from the architecture, not from
volume discounts:
- **Marginal cost per user is near zero.** Static pages are CDN-served; adding
  users adds CDN hits, which are effectively free on all three paths.
- **Cost scales with writes, not reads.** Saving recipes and brew logs writes
  to the database; using the calculators does not touch it. So a user who
  browses and calculates costs nothing; only active savers add load.
- **The step-changes are plan floors, not per-user creep.** The $20/mo Vercel
  Pro floor is the main one — and Paths B and C avoid it entirely.

In plain terms: cost stays **flat and low** as users grow, until you reach
serious scale (tens of thousands of active *writers*, not browsers). You will
not wake up to a surprise four-figure bill from this design unless something is
misconfigured — which is exactly what `npm run space-audit` and the static-first
build are there to prevent.

## Bottom line

- **Cheapest legitimate launch:** Path C (archive-less, Cloudflare Pages, tiny
  DB) → **~$110/year, almost all of it the Apple fee.**
- **Cheapest full-featured (with archive):** Path B (self-host VPS) →
  **~$180–280/year**, at the cost of running your own ops.
- **Least effort:** Path A (Vercel Pro + Neon) → **~$350–460/year**, zero ops.

None of these is expensive in absolute terms. The thing to internalise is that
the fixed Apple fee, not the servers, is the floor — the architecture already
keeps the variable cost near zero.
