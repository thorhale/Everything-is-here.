# Publishing WortHogg to the app stores (Capacitor)

This is the scaffold and runbook for wrapping the existing web app in a native
shell with [Capacitor](https://capacitorjs.com). It is deliberately honest
about what this does and does not get you, because two of the three things
standing between here and a live App Store listing are not code.

## What this scaffold is

`app/capacitor.config.json` configures Capacitor in **hosted (server) mode**:
the native app is a hardened WebView that loads the live site. We chose this
over a static bundle because WortHogg is a server-rendered Next.js app —
server components read Prisma and the filesystem at request time. A static
export (the usual Capacitor target) would mean moving every one of those data
reads behind an API and converting the server components, which is a rewrite,
not a wrapper. Hosted mode ships the current architecture as-is.

The tradeoff is that hosted mode is exactly the shape Apple scrutinises. See
the risks below — the config alone will not clear review.

## Prerequisites (none of which exist in the cloud dev container)

- A **Mac with Xcode** for iOS; **Android Studio** for Android. The native
  build toolchains cannot run in this Linux container, so the `.ipa`/`.aab`
  must be produced locally.
- The **live URL** of the deployed site. Put it in `capacitor.config.json` in
  place of `REPLACE-WITH-LIVE-URL`. Until then the shell loads nothing.
- Apple Developer Program membership ($99/yr) and/or Google Play Console
  ($25 once).

## Build steps (run on the Mac, from `app/`)

```bash
# 1. Install Capacitor (not added to package.json yet, so the web build and
#    tsc stay clean until you actually do native work).
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android \
            @capacitor/share @capacitor/app @capacitor/network

# 2. Add the native platform projects. These create ios/ and android/ folders
#    (large, and gitignored — see .gitignore). Do NOT run this in the cloud
#    container; it needs the native SDKs.
npx cap add ios
npx cap add android

# 3. Point the shell at your live site first (edit capacitor.config.json),
#    then sync the config into the native projects.
npx cap sync

# 4. Open in the native IDE to sign, set icons/splash, and archive for submit.
npx cap open ios
npx cap open android
```

## The three things that actually gate publishing (not solved by this scaffold)

Ranked by how likely each is to stop a submission.

### 1. Apple Guideline 4.2 — "minimum functionality"
A native app that is just a WebView around a website is routinely rejected.
Hosted mode is precisely that shape. To pass, the app needs genuine native
value the browser cannot give:
- **Offline calculators.** The pitching, water, and recipe-engine math is pure
  arithmetic with no server dependency — it can run in the shell with no
  network. This is the strongest 4.2 answer and it is real work worth doing
  regardless of the store, because offline is a genuine feature.
- **Native share / export** of a recipe (the `@capacitor/share` dep above).
- **Home-screen install with a real icon and splash** (already half-started via
  `InstallPrompt.tsx`).

### 2. Intellectual property (Apple 5.2, Google equivalent)
The README describes this as an *"unofficial, unaffiliated BrewToad archive,"*
and the app hosts ~118k recipes scraped from BrewToad's Wayback capture. A free
hobby site and a paid/store-listed product are different risk postures. Before
submission:
- Decide whether the store product ships **with** the scraped recipe archive or
  is the **tools + curated data** only (calculators, guidelines, ingredient/
  water/yeast catalogs — all first-party or properly sourced). Shipping the
  tools without the archive removes most of this risk in one move.
- The existing takedown flow is reactive; a store reviewer will not file a
  takedown, they will reject. Consider the brand name too — a pun on a real
  product invites the association you may not want on a paid listing.

### 3. No user accounts
Every freemium/pro model needs accounts + per-user data, and the app has
neither (auth is admin-only; `Brewer`/`Recipe` are the archive, not app users).
Without accounts there is nothing to gate behind "Pro," nothing to sync, and no
retention hook — which also weakens the 4.2 "real app" argument. This is the
foundation the monetization model rests on and is the recommended first real
build.

## Honest summary

The Capacitor config is the easy 10%. The shell will *run* against the live
site as soon as the URL is set and it is built on a Mac. But shipping it to the
App Store realistically needs, in order: offline calculators (4.2), a decision
on the recipe archive (IP), and user accounts (the whole point of publishing a
product rather than a website). None of those are native-shell work.
