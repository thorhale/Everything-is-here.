# App Store readiness checklist

Where the store launch actually stands. Grouped by who can do it: some is code
(done or doable here), some needs your accounts and decisions, some needs a Mac.

## Done (in the codebase)

- [x] **Offline calculators.** Pitching, recipe calculator, water builder, and
      unified builder are statically prerendered and run with no network — the
      substantive answer to Apple's 4.2 "minimum functionality" review.
- [x] **Service worker caches the offline routes** (public/sw.js), by strict
      allowlist, so they work offline in the installed/native app while live
      pages and auth stay network-only.
- [x] **PWA manifest + install prompt** (icons, maskable variants, shortcuts).
- [x] **User accounts** via Google/Apple (Auth.js, JWT sessions). Wired and
      gated on credentials.
- [x] **Capacitor config** for the native shell (hosted mode) — docs/native-app.md.
- [x] **World-class reference data on record** — the Brewing Elements books and
      the primary sources they synthesise, with an honest provenance system.
- [x] **Cost-safe architecture** — static-first, JWT sessions, a database-size
      audit gate (`npm run space-audit`). See docs/operating-costs.md.

## Needs your accounts / credentials

- [ ] **Apple Developer Program** ($99/yr) — required to build and submit iOS.
- [ ] **Google Play Console** ($25 once).
- [ ] **OAuth credentials** for Google and Apple sign-in (docs/accounts.md).
      Note: the App Store requires that if you offer Google sign-in you also
      offer Apple.
- [ ] **Apply the auth tables** to the database
      (`node --env-file=.neon.env create-auth-tables.mjs`).
- [ ] **Rotate the database credential** that was shared in chat, and set all
      secrets via the environment, never in the repo.

## Needs a product decision

- [ ] **Ship with or without the scraped recipe archive?** This is the single
      biggest decision left. Shipping a *paid* app that hosts 118k scraped
      BrewToad recipes is real intellectual-property exposure, and a store
      reviewer rejects rather than files a takedown. Shipping tools + curated
      data only removes most of that risk **and** unlocks the near-zero-cost
      hosting path (docs/operating-costs.md, Path C). The archive is an
      SEO/discovery asset, so this is a genuine trade, not a free win.
- [ ] **The name.** "WortHogg" as an "unofficial, unaffiliated BrewToad
      archive" is fine for a hobby site; on a paid listing the BrewToad
      association invites scrutiny. Decide whether the store product keeps the
      framing or stands on its own as a tools app.
- [ ] **Monetization specifics** — free vs. Pro split, and price. The accounts
      foundation is built; nothing is gated yet.

## Needs building (code, when you want it)

- [ ] **"Save this recipe"** — the first thing accounts should unlock, hung off
      `User.id`. The reason accounts exist; the first candidate for a Pro gate.
- [ ] **Privacy policy + account deletion.** Both stores require a privacy
      policy URL, and Apple requires in-app account deletion for any app with
      account creation. Straightforward but mandatory.
- [ ] **Store listing assets** — screenshots at required sizes, app description,
      keywords, support URL, age rating (note: a brewing/alcohol app draws an
      age gate on both stores).
- [ ] **Native app icons and splash screens** at the platform sizes.

## Needs a Mac

- [ ] **Build and submit.** `npx cap add ios/android`, sign, archive, upload —
      Xcode/Android Studio only, cannot be done in the cloud container. The
      config and runbook are ready (docs/native-app.md).

## Suggested order

1. Product decision on the archive (gates hosting choice and IP posture).
2. "Save this recipe" + privacy policy + account deletion (feature-complete).
3. Apple/Google accounts, OAuth credentials, apply auth tables.
4. Store assets, then the Mac build and submit.
