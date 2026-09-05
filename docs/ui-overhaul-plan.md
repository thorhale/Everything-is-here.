# WortHogg UI & overall overhaul — execution plan

Measured 2026-09-05 against branch `claude/mr-malty-pitching-calculator-bh3ol0`
at commit `9f93a8a`, with a production build rendered in headless Chromium at
1280×800 and 390×844 and scanned with axe-core 4.13. Every number below came
out of `app/scripts/ui-audit.cjs`; re-run it to re-measure rather than
trusting this file.

This document is written for a model executing it cold. Section 0 is the
contract; sections 1–2 are what was found and why it matters; section 3 is
the ordered work, each phase with exact files, acceptance criteria and the
commands that prove them; section 4 is the gate to run after every phase.

---

## 0. Read this first — operating rules

**Repository facts**
- Repo root is `/home/user/Everything-is-here.` (note the trailing dot). The
  Next.js 14 app lives in `app/`; run npm commands from there. `data/` is a
  sibling of `app/`, traced into serverless bundles by
  `experimental.outputFileTracingIncludes` in `app/next.config.js`.
- Work on branch `claude/mr-malty-pitching-calculator-bh3ol0` only. Never push
  elsewhere. Do not open pull requests unless asked.
- Commit messages end with these two trailers, verbatim:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XNcB5BS6pQtJQPDDwhBgGA
  ```
  No model identifiers anywhere else in the tree.
- `next build` runs with **no `DATABASE_URL`, by design**. Consequences:
  non-parameterised routes that read the database must stay
  `export const dynamic = "force-dynamic"`; parameterised routes may use
  `revalidate`. GET route handlers with no dynamic API are prerendered at build
  — any new one that touches the database needs `force-dynamic` too.
- The database connection string is not available in the agent environment.
  Nothing in this plan requires it; if a step seems to, the step is wrong.
- GitHub Actions minutes are being conserved until the owner says otherwise:
  **do not add workflow files.** Gates run locally.
- Do not ask about merging any branch in other repositories.
- Numbers shown to users must trace to a fetched document (`data/sources/`);
  this plan changes presentation, not data. Provenance ratchets
  (`app/sources-budget.json`, `app/diastatic-budget.json`) may only fall.
- `python3 scripts/derive-math-fixtures.py` must regenerate
  `data/math-verified.json` byte-identically; the corpus values are pinned by
  `app/lib/math-verified.test.ts` and countersigned by Wolfram. Do not touch
  formulas.
- `next build` prints `TypeError: Cannot read properties of undefined
  (reading 'os')` three times — Next telemetry failing in the sandbox. Benign;
  judge the build by its exit code and the route table.
- Playwright's own browser download is absent; Chromium is at
  `/opt/pw-browsers/chromium`. Pass it as `PW_EXE`.
- `pdftotext` is not installed; `pdfminer.six` is. Irrelevant here unless a
  source PDF is re-read.

**Design constraints (deliberate, do not relitigate)**
- Plain CSS with custom properties in `app/app/globals.css`. No Tailwind, no
  CSS-in-JS, no component library. The BrewToad-derived palette and the
  `.srm0–.srm40` swatches stay.
- The site is content-first and mostly server-rendered. Client components stay
  where they are (`Toolbox`, `BuilderForm`, `PitchingWorkbench`,
  `WaterBuilder`, `RecipePitching`, `ShopThisRecipe`, `InstallPrompt`, and a
  new `SiteNav`). Do not convert server pages to client components.
- Behaviour-preserving refactors only. A phase that changes what a calculator
  outputs has gone wrong; `npm test` (145 tests at time of writing) guards it.

**Definition of done for the whole plan**
`node scripts/ui-audit.cjs http://localhost:3123 /tmp/ui-audit --strict`
passes; `npx tsc --noEmit`, `npm test`, `npx next build`,
`node scripts/validate-sources.mjs` all pass; and the baseline table in
section 2 has been re-measured with every row improved.

---

## 1. Findings — what the deep dive found, with evidence

### 1.1 Accessibility (measured with axe-core, 12 routes)

| Rule | Impact | Count | Where |
|---|---|---|---|
| `color-contrast` | serious | **537 nodes on 12/12 routes** | every use of `--wh-text-light` (#918f90) on white or `--wh-bg-soft` |
| `region` | moderate | 12 (one per route) | `.wh-disclaimer` sits outside any landmark |
| `heading-order` | moderate | 2 | `h1 → h3` jumps (Toolbox cards, recipe sections) |
| `select-name` | **critical** | 2 | `/build`: the "Add from the ingredient database…" and "Add a hop…" selects have no accessible name (`BuilderForm.tsx:619`, `:761`) |

- `--wh-text-light` measures **3.21:1 on white and 2.94:1 on `--wh-bg-soft`**;
  WCAG AA needs 4.5:1. It is used **239 times** for secondary text, mostly at
  0.72–0.85 rem, so it is the single largest readability defect on the site.
  `#6b686a` measures 5.51:1 / 5.04:1 and keeps the warm-grey tone.
- Nav dropdowns are `:hover`-only. Measured: focusing a top-level item leaves
  its submenu `display: none`, so keyboard users cannot reach 15 of the 19
  navigation links except via the footer. On a phone the submenu opens only
  through Chromium's tap-to-hover heuristic (measured: the first tap on
  "Styles & Ingredients" does not navigate) — no visible affordance, no
  `aria-expanded`, no way to dismiss but tapping elsewhere, and a second tap
  navigates. Whether it opens at all is browser-dependent.
- Tap targets in the site chrome are 15 px tall (footer links, disclaimer
  link) and 22 px (header "Account"); WCAG 2.2 asks for 24 px minimum.
- No skip-to-content link. Focus styling is the browser default
  (`outline auto 1px`), never designed.
- Heading structure: `/` has **no h1** (the logo is an image); `/sources`,
  `/account`, `/admin/takedowns` render **two** h1s; 50 `<h3>` versus 36
  `<h2>` across the tree because section headings default to h3.

### 1.2 Navigation, header, mobile

- Header content spans the full viewport while nav and main are capped at
  960 px, so the logo sits ~160 px left of the first nav item on desktop.
- On a 390 px phone the disclaimer + three-row header + two-row nav occupy
  **~41 % of the first screen** before content starts (measured on the 404
  page: main begins at ~350 px of 844).
- `/tools` on a phone is a single **11,876 px** tall column of 14 cards with
  no index, no anchors, no collapse.
- In `/build` on a phone the ingredient `<select>` spills past its fieldset
  border (visible in the screenshot; no `max-width`/`min-width: 0` on selects
  inside panels).
- `body { overflow-x: hidden }` masks any horizontal overflow instead of
  fixing it.

### 1.3 Design system and consistency

- **743 inline `style={{…}}` blocks**; 13 files with 18+ each
  (`BuilderForm.tsx` 110, `yeasts/db/[id]` 42, `sources` 42). Only ~130
  `className` uses outside `layout.tsx`. The stylesheet's tokens are
  under-used; layout is hand-rolled per page.
- **84 hard-coded hex colours in TSX**: `#ccc` ×13 (input borders, where the
  stylesheet already defines `--wh-border`), `#666` ×9 (lead paragraphs,
  where `--wh-text-light` is meant), `#eee` ×6 (list dividers), plus ad-hoc
  semantic colours with no token: amber `#9a6700` ×8, greens `#1a7f37`/`#3f7d3f`
  ×8, and the takedown submit button `#3a2a1a` (off-brand).
- Primitives are re-declared per file: `Card` ×4 (Toolbox, home, …),
  `Field` ×3, `Stat` ×3, `Row` ×2, plus `Panel`, `Badge`, `Chip`, `StatMini`,
  `PlainStat`, `BandStat` once each. Each has slightly different padding,
  radius and font sizes.
- `app/recipes/page.tsx` re-implements `components/RecipeList.tsx` inline and
  so **loses the `lang` attributes** `RecipeList` applies to non-Latin titles.
- Three list pages (`hops/db`, `yeasts/db`, `fermentables/db`) each define
  identical `inp`/`lbl` style objects.
- No dark mode: tokens exist only on `:root`; `main` is hard-coded `#fff`,
  headings `#3d3a3b`, `viewport.themeColor` is a single value.
- No print stylesheet, though recipe pages are exactly what brewers print.

### 1.4 Resilience

- **No `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx`
  anywhere.** With the database unreachable, `/` and `/recipes` render Next's
  bare "Application error: a server-side exception has occurred" with no site
  chrome. Unknown URLs get the default "404 | This page could not be found"
  inside the layout. Neither offers a way forward, and the calculators — which
  need no database — are not suggested.
- The home page's five database counts are a hard dependency; a database blip
  takes down the front door even though nothing else on that page needs it.

### 1.5 Performance and assets

- First-load JS is healthy: 87 kB shared, largest route `/build` at 117 kB.
  Not a problem area.
- `public/brand/` is **3.3 MB**. `worthogg-logo.png` is **1.1 MB** and is the
  home page's LCP element, rendered at ≤ 360 px wide. `worthogg-card.png`
  (986 KB) and `worthogg-mascot.png` (500 KB) are **referenced by nothing**.
  `icon-512.png` is 350 KB; `app/icon.png` (the favicon) is 87 KB.
- `/sources` renders 3,760 DOM elements in one page.

### 1.6 Metadata, SEO, PWA

- No `title.template`; 41 pages hand-append " — WortHogg" and **four use " -
  " instead** (`brewers`, `yeasts`, `hops`, `fermentables`). The home page has
  no `metadata` export and inherits the layout description, which still
  positions the site as "an unofficial… archive of BrewToad's homebrew
  recipes" while the home page copy says "Plan and calculate any ferment".
- **No Open Graph or Twitter metadata anywhere**, so a shared recipe link
  renders bare. No `sitemap.xml`, no `robots.txt` — for 117,000 recipe pages.
- `public/sw.js` precaches `/calculator` in `OFFLINE_ROUTES`, but
  `/calculator` is now a redirect to `/build`; a cached redirected response
  served to a navigation request is rejected by the browser.
- `app/manifest.ts` hard-codes "117,000" in its description and its comment
  cites `components/ServiceWorker.tsx`, which does not exist (registration
  lives in `InstallPrompt.tsx`).
- `/favicon.ico` is 404 (only `app/icon.png` exists); harmless for modern
  browsers, wrong for some feed readers and legacy tabs.

### 1.7 Code health

- **30 operational `.mjs` scripts sit loose in `app/`** beside the app
  (loaders, validators, audits, migrations). Six resolve paths relative to
  `import.meta.url`; `package.json` `build` and `space-audit` call two of them
  by relative name.
- No ESLint config and no `lint` script, though `// eslint-disable-next-line
  @next/next/no-img-element` comments exist in five files. No `typecheck`
  script.
- `lib/brewtoad-ref.ts` is imported only by its own test.
- `lib/generated/*.json` are tracked *and* regenerated by the `build` script;
  nothing checks the regeneration is a no-op.
- Duplicate 10-line comment block explaining `force-dynamic` at the top of
  `app/page.tsx` and `app/ingredients/page.tsx` (and the first paragraph of it
  twice in `page.tsx`).
- `/tools` page copy still describes the old card set and links to
  `/calculator` (a redirect) instead of `/build`.

### 1.8 Documentation

- `README.md` last changed 2026-07-10 and `docs/` 2026-08-07; both predate the
  ingredient databases, the all-drinks builder, style guidelines, water,
  pitching, draught-line and barrel tools, the source registry, and the
  CAS-verified math corpus.

---

## 2. Baseline table (re-measure after each phase)

| Metric | How to measure | Baseline 2026-09-05 | Target |
|---|---|---|---|
| axe serious+critical nodes (12 routes) | `ui-audit.cjs` summary | 539 | 0 |
| axe moderate (`region`, `heading-order`) | `ui-audit.cjs` | 14 | 0 |
| Routes with exactly one `<h1>` | `ui-audit.cjs` per-route `h1=` | 12 of 14 rendered | all |
| Nav submenu reachable by keyboard | `ui-audit.cjs` → `navigation.keyboard` | `submenuVisibleOnFocus: false` | true or `aria-expanded` present |
| Phone nav exposes its state | `ui-audit.cjs` → `navigation.touch.tapOpenedMenu` | false (hover heuristic only) | true (`aria-expanded`) |
| Chrome share of first phone screen | `ui-audit.cjs` `chrome=` | ~41 % | ≤ 15 % |
| Inline `style={{` blocks | `grep -rho --include=*.tsx 'style={{' app components \| wc -l` | 743 | < 200 |
| Hex colours in TSX (excl. SRM tables) | `grep -rho --include=*.tsx -E '#[0-9a-fA-F]{3,6}\b' app components \| wc -l` | 84 | ≤ 20 (all inside `srmToHex`/swatch tables) |
| Duplicate primitive definitions | `grep -rhoE --include=*.tsx '^function (Card\|Field\|Stat\|Row)\(' app components \| sort \| uniq -c` | Card 4, Field 3, Stat 3, Row 2 | 1 each |
| `public/brand/` size | `du -sh app/public/brand` | 3.3 MB | ≤ 600 KB |
| Largest served image | `ui-audit.cjs` "images over 150 KB" | 1.1 MB | none over 150 KB |
| Pages with `error.tsx`/`not-found.tsx`/`loading.tsx` | `find app/app -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'loading.tsx'` | 0 | ≥ 8 |
| `/` renders without a database | `ui-audit.cjs` status of `/` | 500 | 200 |
| Title separator variants | `grep -rh --include=page.tsx 'title:' app \| grep -c ' - WortHogg'` | 4 wrong | 0 (template) |
| OG/Twitter metadata | `grep -rl openGraph app \| wc -l` | 0 | layout + recipes + guidelines |
| `sitemap.xml`, `robots.txt` | `curl -s -o /dev/null -w %{http_code}` | 404 | 200 |
| Loose `.mjs` in `app/` root | `ls app/*.mjs \| wc -l` | 30 | 0 |
| `npm run lint` | — | script absent | 0 errors |
| Tests | `npm test` | 145 pass | ≥ 145 pass |

---

## 3. The work, in order

Phases are ordered by value per unit of risk and each is independently
shippable. Commit at the end of each phase (or each numbered step for the
larger ones) and run the gate in section 4 before committing. Do not start a
phase until the previous one's acceptance criteria hold.

### Phase 0 — Make the gate runnable (½ hour)

1. `@axe-core/playwright` is already a devDependency and
   `app/scripts/ui-audit.cjs` is committed. Confirm it runs:
   ```
   cd app && npx next build
   (npx next start -p 3123 &) ; sleep 5
   PW_EXE=/opt/pw-browsers/chromium node scripts/ui-audit.cjs http://localhost:3123 /tmp/ui-audit
   ```
   Expect the baseline numbers from section 2 (539 serious+critical, nav not
   keyboard-reachable, `/` = 500). Stop the server afterwards
   (`pgrep -f "[n]ext-server" | xargs -r kill`).
2. Add to `app/package.json` scripts:
   `"typecheck": "tsc --noEmit"`, `"audit:ui": "node scripts/ui-audit.cjs"`.

**Acceptance:** the audit runs to completion and writes `/tmp/ui-audit/audit.json`.

### Phase 1 — Tokens, contrast, focus, dark mode (`globals.css` + a sweep)

Goal: every colour on the site comes from a token; every token passes AA in
light and dark; keyboard focus is visible and designed.

1. In `app/app/globals.css` `:root`, change `--wh-text-light` to `#6b686a`
   (5.51:1 on white, 5.04:1 on `--wh-bg-soft`). Add tokens:
   ```
   --wh-surface: #fff;            /* main content background (was hard-coded) */
   --wh-surface-2: #f5f5f0;       /* = --wh-bg-soft; cards, panels */
   --wh-heading: #3d3a3b;         /* h1–h3 colour (was hard-coded) */
   --wh-divider: #eee;            /* list/table row dividers (was #eee ×6) */
   --wh-input-border: var(--wh-border);   /* replaces #ccc ×13 */
   --wh-ok: #1a7f37;  --wh-ok-bg: #e8f3ea;
   --wh-warn: #9a6700; --wh-warn-bg: #fff4d6;
   --wh-danger: #a12a1b; --wh-danger-bg: #f7e8e4;
   --wh-focus: #325f86;
   ```
   Replace the hard-coded `#fff` on `main.wh-main`, `#3d3a3b` on headings,
   `#eee` on `td`, and the `.horizontal-bar-graph .bar` greys with tokens.
2. Add a focus style once, globally:
   ```
   :focus-visible { outline: 2px solid var(--wh-focus); outline-offset: 2px; border-radius: 2px; }
   .site-nav :focus-visible, .wh-disclaimer :focus-visible { outline-color: #fff; }
   ```
3. Add a `.visually-hidden` utility (standard clip pattern) — Phase 3 and 6 use it.
4. Sweep TSX for hard-coded colours. Rules, mechanical:
   - `#ccc` in `inp`/`inputStyle` objects → `var(--wh-input-border)`.
   - `color: "#666"` → `var(--wh-text-light)`.
   - `borderBottom: "1px solid #eee"` → `var(--wh-divider)`.
   - `#9a6700`, `#1a7f37`, `#3f7d3f`, `#f7e8e4`, `#c00` → the matching
     `--wh-ok/--wh-warn/--wh-danger` token (check each site's meaning; amber is
     warning, green is confirmation, red is failure).
   - Takedown submit button: drop `submitBtnStyle`, use `className="wh-btn"`.
   - Leave `SRM_HEX` in `BuilderForm.tsx` and the `.srmN` classes alone; those
     are physical beer colours, not UI colour.
5. Dark mode. Below the `:root` block, add one — and only one — dark block:
   ```
   @media (prefers-color-scheme: dark) {
     :root {
       --wh-surface: #1f1c1d; --wh-surface-2: #292527; --wh-bg-soft: #292527;
       --wh-bg-warm: #2b2526; --wh-text: #e6e1de; --wh-text-light: #a8a2a0;
       --wh-heading: #f0ebe8; --wh-border: #46403f; --wh-border-light: #3a3536;
       --wh-divider: #3a3536; --wh-link: #8fb4d6; --wh-accent: #e0762a;
       --wh-ok: #6fcf8f; --wh-ok-bg: #16301f; --wh-warn: #e6b450; --wh-warn-bg: #3a2e10;
       --wh-danger: #f28b7a; --wh-danger-bg: #3d1a15; --wh-focus: #8fb4d6;
     }
     html { color-scheme: dark; }
     .wh-style-chip { background: #3a3536; color: #e6e1de; }
     .swatch, .recipe-color { border-color: rgba(255,255,255,0.25); }
   }
   ```
   Then check contrast of every dark pair with the same formula used for
   light (WCAG relative luminance; ≥ 4.5:1 for text). Adjust until all pass.
   In `app/app/layout.tsx`, make `viewport.themeColor` an array with
   `(prefers-color-scheme: light|dark)` media entries.
6. Inline styles that set `background: "#fff"` (InstallPrompt, account
   buttons, `.wh-btn-secondary`) → `var(--wh-surface)`.

**Acceptance**
- `ui-audit.cjs`: `color-contrast` = 0 nodes on every route, light mode.
- Run the audit once more with the phone context set to
  `colorScheme: "dark"` (add `--dark` flag to the script that passes
  `colorScheme` into both contexts) and confirm 0 contrast violations and
  readable screenshots.
- `grep -rho --include=*.tsx -E '#[0-9a-fA-F]{3,6}\b' app components | wc -l`
  ≤ 20, all inside `SRM_HEX`/swatch code.
- `npm test`, `tsc`, `next build` green.

### Phase 2 — Shared UI primitives, and the migrations that pay for them

Goal: one definition of each visual primitive; inline style count halves.

1. Create `app/components/ui.tsx` (server-safe, no hooks) exporting:
   `Card({title, id, children})` (renders `<section class="wh-card"><h2 class="wh-card-title">`),
   `Field({label, children, hint})` (a `<label class="wh-field">` wrapping any
   control), `Row({label, children})` (label-left/control-right variant used by
   Toolbox), `Out({label, value})`, `Chip({href, active, children})`,
   `Stat({n, label, href})`, `Panel`, `Badge({tone: "ok"|"warn"|"danger"|"muted"})`,
   `Note({tone, children})` for the small-print/warning paragraphs, and
   `FilterForm` (the GET form shell used by the three database list pages).
   Put their CSS in `globals.css` under a `/* --- UI primitives --- */` section
   using the Phase 1 tokens. Keep props minimal; no variants beyond what
   existing call sites need.
2. Migrate, in this order, verifying screenshots after each:
   `app/app/tools/Toolbox.tsx` (drop its local `Card/Row/Out/inp`; card
   titles become `<h2>`), `app/app/page.tsx` (`Card`, `Stat`),
   `app/app/build/BuilderForm.tsx` primitives at the bottom of the file
   (`Field`, `Panel`, `PlainStat`, `BandStat`, `StatMini` → shared where the
   shape matches; keep `BandStat` local if it has no twin),
   `components/StrainCard.tsx`, `components/RecipeList.tsx`,
   `app/app/hops/db`, `yeasts/db`, `fermentables/db`, `additives` (shared
   `FilterForm`, drop the per-file `inp`/`lbl`), `app/app/recipes/page.tsx`
   (**replace the inline list with `<RecipeList recipes={recipes} />`** — this
   restores `lang` tagging on non-Latin titles), `app/app/takedown/page.tsx`,
   `app/app/account/page.tsx`, `components/InstallPrompt.tsx`.
3. Fix the phone spill: in `globals.css`, `main select, main input[type=text],
   main input[type=number] { max-width: 100%; min-width: 0; }` and give
   `fieldset` `min-width: 0` (fieldsets default to `min-inline-size:
   min-content`, which is what lets the select escape).
4. Remove `body { overflow-x: hidden }` and fix whatever the audit's
   `overflow` list then reports (expected: nothing after step 3).

**Acceptance**
- Inline `style={{` count < 200 (`grep` in section 2).
- `grep -rhoE --include=*.tsx '^function (Card|Field|Stat|Row)\(' app components | sort | uniq -c` shows each once (in `ui.tsx`).
- `ui-audit.cjs` phone `spill=0` on every route; `overflow` empty.
- `/recipes` list items carry `lang` attributes where `RecipeList` adds them
  (check with the database later; for now the component swap is the proof).

### Phase 3 — Navigation and site chrome

Goal: every navigation link reachable by keyboard and touch; header aligned
with content; phone chrome under 15 % of the first screen; every tap target
≥ 24 px; landmarks complete.

1. Create `app/components/SiteNav.tsx` (`"use client"`, ≤ 150 lines). Move the
   `<nav className="site-nav">` markup from `layout.tsx` into it. Data: a
   `NAV` array of `{label, href, children: {label, href}[]}` exported from
   `app/lib/nav.ts` and **also used to render the footer**, so the two lists
   can never drift.
   - Desktop (≥ 761 px): top-level rendered as `<Link>` plus a 32 px
     `<button aria-expanded aria-controls aria-label="Open {label} menu">`
     chevron; the submenu (`<ul id=…>`) is shown when the `li` is hovered,
     when it contains focus (`li:focus-within > ul { display: block }`), or
     when its button's `aria-expanded="true"`. Escape closes; clicking outside
     closes; only one open at a time.
   - Phone (< 761 px): the bar collapses to a single `<button
     aria-expanded aria-controls="site-menu">Menu</button>` that toggles a
     full-width panel listing every group with its links, plus "Account" and
     the search form. No hover behaviour at all.
2. Header: wrap header contents in a 960 px centred container (same
   `max-width`/`margin: 0 auto` as `.site-nav > ul` and `main.wh-main`). On
   phones: one row — logo, a search icon button that expands the search
   field (or the field itself at reduced width), the Menu button. "Account"
   moves into the menu panel on phones.
3. Disclaimer: keep it, shrink to one line on phones with the link, and give
   it a landmark: `<aside role="note" aria-label="About this archive">` (axe
   `region` accepts `aside`). Alternatively place it inside `<header>`.
4. Skip link: first child of `<body>`: `<a href="#main"
   className="skip-link">Skip to content</a>` (visually hidden until focused);
   `<main id="main" tabIndex={-1}>`.
5. Tap targets: footer and menu links get `display: block; padding: 0.35rem
   0` so they measure ≥ 24 px; the disclaimer and header links ≥ 24 px via
   `padding` or `line-height`.
6. Footer: the first `<li>` in each column is a heading in disguise — render
   it as `<h2 className="footer-heading">` outside the `<ul>`.

**Acceptance (all from `ui-audit.cjs`)**
- `navigation.keyboard.submenuVisibleOnFocus: true` or `ariaExpanded`
  present; `navigation.touch.menuButtonPresent: true`, `tapOpenedMenu: true`,
  `navigatedAway: false`.
- `smallTaps=0` on every route; `chrome=` ≤ 15 % on every route.
- axe `region` = 0; `hasSkipLink: true`.
- Desktop screenshot: logo left edge aligned with first nav item and with the
  `main` content edge (within 2 px).

### Phase 4 — Resilience: error, 404, loading, graceful degradation

1. `app/app/not-found.tsx` (server): branded 404 inside the layout — h1 "This
   page isn't here", the recipe search form, and chips to Recipes, Recipe
   builder, Toolbox, Ingredients, Guidelines. Also call `notFound()` is
   already used on detail pages; this file makes those pretty too.
2. `app/app/error.tsx` (`"use client"`, receives `{error, reset}`): keeps the
   chrome (it renders inside the root layout); copy: "Something went wrong
   loading this page. If the archive database is having a moment, the
   calculators still work." with a **Try again** button calling `reset()` and
   chips to `/build`, `/tools`, `/pitching`, `/water/builder`. Show
   `error.digest` in small print.
3. `app/app/global-error.tsx` (`"use client"`): minimal, includes its own
   `<html><body>`, for failures in the root layout itself.
4. `loading.tsx` skeletons for `app/app/recipes/`, `recipes/[slug]/`,
   `brewers/`, `guidelines/`, `hops/db/`, `yeasts/db/`, `fermentables/db/`:
   the page's h1 plus 3–6 `<div className="skeleton">` blocks. One `.skeleton`
   CSS rule (shimmer, respects `prefers-reduced-motion`).
5. Home page graceful degradation in `app/app/page.tsx`: wrap the counts call
   — `const c = await getCounts().catch(() => null)` — and render the page
   fully when `c` is null: stats row hidden, card blurbs use wording without
   numbers ("Tens of thousands of real homebrew recipes…"). The front door
   must not depend on the database.
6. Delete the duplicated comment block at the top of `page.tsx` (keep one
   copy of the explanation) and dedupe the one in `ingredients/page.tsx` to a
   one-line pointer at the first.

**Acceptance**
- With no `DATABASE_URL`: `/` → 200 with full chrome; `/recipes` → the
  friendly error page **with chrome** (status may be 200 or 500; the visible
  page is what matters — check the screenshot); `/nope` → branded 404.
- `ui-audit.cjs --strict` no longer lists `/` in "returned 500".
- `find app/app -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'loading.tsx' | wc -l` ≥ 10.

### Phase 5 — Toolbox and builder usability

1. Toolbox index: at the top of `app/app/tools/Toolbox.tsx`, a chip row of
   anchor links (one per card) that becomes a sticky, horizontally scrolling
   strip on phones; each `Card` gets `id` and a `<h2>`; a "Back to top" link
   at the end of each card on phones. Update `tools/page.tsx` copy to name the
   current card set (line balance, barrel gauge) and link `/build` rather
   than `/calculator`.
2. `/build` accessible names: `aria-label="Add a fermentable from the
   database"` and `aria-label="Add a hop"` on the two selects
   (`BuilderForm.tsx:619`, `:761`).
3. Builder persistence: recipe state currently dies on refresh. Serialise the
   builder's state (`selected`, `volumeL`, `efficiency`, `attenuation`,
   `tolerance`, `useTolerance`, `rows`, `hopRows`, `boilVolumeL`,
   `selectedStrainId`, `yeastUse`, `bitterThreshold`, `targetSrm`, water and
   must fields) to `localStorage["wh-builder-v1"]` on change (debounced 300
   ms), restore on mount, wrapped in try/catch; add a "Start over" button
   that clears it. Show a one-line "Restored your last recipe" note when a
   restore happened.
4. Split `BuilderForm.tsx` (1,464 lines) by extracting the JSX of each panel
   into `app/app/build/panels/{Batch,Fermentables,Hops,WaterSalts,Must,Result}.tsx`,
   passing state and setters as props. **No logic moves**; the `useMemo`
   engine calls stay in `BuilderForm.tsx`. Target: `BuilderForm.tsx` < 500
   lines, each panel < 300.
5. Phone check of `/pitching` and `/water/builder` tables: wrap each
   `<table>` in `<div className="table-scroll">` (`overflow-x: auto`) and
   remove the global `@media (max-width: 760px) table { display: block }`
   hack once every table has a wrapper (grep `<table` — 20-odd sites).

**Acceptance**
- axe `select-name` = 0.
- `wc -l app/app/build/BuilderForm.tsx` < 500; `npm test` unchanged.
- Manual: change three builder fields, reload, values persist; "Start over"
  clears.
- `/tools` phone screenshot shows the sticky index; every card `id` resolves.

### Phase 6 — Heading structure and semantics

1. Every page exactly one `<h1>`: home gets
   `<h1 className="visually-hidden">WortHogg</h1>` above the logo (and the
   logo `alt` becomes `""` since the h1 now names it); `/sources` — one h1
   (the second is a duplicate in a fallback branch; give the fallback an h2
   or reuse the same h1 once); `/account` and `/admin/takedowns` — same.
2. Section headings under an h1 are `<h2>`; sub-sections `<h3>`. Sweep with
   `grep -rn '<h3' app components` (50 sites): recipe page sections
   (Fermentables, Hops, Yeasts, Notes, Comments, Stats, Suggested yeasts,
   Water & mash pH, Export) → h2; Toolbox cards already h2 from Phase 2;
   guidelines/style pages likewise. Adjust font sizes via the `.wh-card-title`
   / a `.section-title` class, not by heading level.

**Acceptance**
- axe `heading-order` = 0; `ui-audit.cjs` shows `h1=1` for every rendered
  route; `--strict` passes the h1 check.

### Phase 7 — Metadata, SEO, PWA correctness

1. `app/lib/seo.ts`: `export function pageMeta({title, description, path,
   image?}): Metadata` returning `title`, `description`, `alternates.canonical`,
   `openGraph {title, description, url, siteName: "WortHogg", type,
   images:[{url, width:1200, height:630}]}`, `twitter {card:
   "summary_large_image"}`. In `layout.tsx`: `title: {default: "WortHogg",
   template: "%s — WortHogg"}`, a repositioned description ("Plan and
   calculate any ferment — beer, wine, cider, mead, sake and spirits — with
   sourced ingredient data, plus the recovered BrewToad recipe archive."),
   `metadataBase` from `NEXT_PUBLIC_SITE_URL` with a fallback, and the OG
   defaults.
2. Sweep all 41 page `metadata` exports: strip the " — WortHogg" / " -
   WortHogg" suffixes (the template adds it), route through `pageMeta`.
   `generateMetadata` on recipe, guideline, hop, yeast, fermentable, water,
   additive, brewer pages: pass the entity's title/description through
   `pageMeta`. Home page gets its own `metadata`.
3. OG image: produce `public/brand/og-card.png` at 1200×630 ≤ 250 KB from
   `worthogg-card.png` (Phase 8 tooling), then delete `worthogg-card.png` and
   `worthogg-mascot.png` (unused).
4. `app/app/robots.ts`: allow all, disallow `/admin`, `/account`, `/api`,
   list `Sitemap:` for `/sitemap.xml` and `/sitemaps/recipes.xml`.
   `app/app/sitemap.ts`: **static routes only** (no database; this file is
   evaluated at build). `app/app/sitemaps/recipes.xml/route.ts` with
   `export const dynamic = "force-dynamic"` returning a sitemap index of
   `/sitemaps/recipes/[n].xml`; `app/app/sitemaps/recipes/[n].xml/route.ts`
   (`revalidate = 86400`) emitting 40,000 `<url>` entries per page from
   `prisma.recipe.findMany({where:{isHidden:false}, select:{slug:true,
   scrapedAt:true}, orderBy:{id:"asc"}, skip, take})`. Both handlers must
   survive `next build` without a database — the index one only because it is
   `force-dynamic`; do not remove that.
5. `public/sw.js`: remove `"/calculator"` from `OFFLINE_ROUTES`; bump `CACHE`
   to `"worthogg-v3"`. `app/app/manifest.ts`: description without the
   hard-coded count; fix the comment to say `components/InstallPrompt.tsx`.
6. `public/favicon.ico`: generate a 32 px ICO from `app/icon.png`; shrink
   `app/icon.png` itself to 64 px (≤ 10 KB).
7. Print stylesheet in `globals.css`:
   ```
   @media print {
     .wh-disclaimer, .wh-header form, .site-nav, .site-footer, .skip-link,
     [role=complementary], .recipe-show--aside .no-print, .wh-btn, .wh-btn-secondary { display: none !important; }
     main.wh-main { max-width: none; border: 0; padding: 0; }
     a[href]::after { content: ""; }  /* no URL clutter in tables */
     .recipe-header a::after { content: " (" attr(href) ")"; font-size: 0.8em; }
   }
   ```
   Check `/recipes/[slug]` print preview (Playwright `page.emulateMedia({media:
   "print"})` + screenshot) shows title, stats, ingredient tables only.

**Acceptance**
- `curl -s -o /dev/null -w %{http_code} localhost:3123/robots.txt` = 200;
  `/sitemap.xml` = 200 and lists only static routes; `/sitemaps/recipes.xml`
  = 200 when a database is present and a friendly 503/empty index when not
  (never a crash at build).
- `grep -rh --include=page.tsx 'WortHogg"' app/app | wc -l` = 0 (template does it).
- Every audited page's `<title>` ends with " — WortHogg" exactly once and
  has `og:title`, `og:image`, `twitter:card` (`page.$$eval('meta[property^=og:]')`).
- `next build` route table shows `sitemap.xml` and `robots.txt` as static (○)
  and the recipe sitemaps as dynamic (ƒ).

### Phase 8 — Assets and load performance

1. Tooling: `cd app && npm i --no-save sharp` (do not add to package.json).
   Write `app/scripts/optimize-brand.mjs` (commit it) that reads
   `public/brand/*.png` originals and writes: `worthogg-logo.webp` + `.png` at
   720 px wide (≤ 80 KB / ≤ 160 KB), `og-card.png` 1200×630 (≤ 250 KB),
   `icon-512.png` re-encoded (≤ 120 KB), `icon-maskable-512.png` (≤ 100 KB),
   `mascot-64.png` (≤ 8 KB), `apple-touch-icon.png` 180 px (≤ 30 KB). Use
   `png({palette: true, quality: 80})`/`webp({quality: 82})`.
2. Home logo: `<picture>` with the WebP source and PNG fallback, explicit
   `width`/`height` attributes (prevents layout shift) and
   `fetchPriority="high"` — it is the LCP element. Header mascot gets
   `width`/`height` too.
3. Delete `worthogg-card.png` and `worthogg-mascot.png` (unused; confirm with
   `grep -rn worthogg-card app components public` = 0 after Phase 7 moved OG
   to `og-card.png`).
4. `/sources` (3,760 elements): the per-kind `<details>` already collapse;
   render the closed `<details>` bodies lazily is not possible server-side,
   so instead paginate nothing and leave it — but move the 200-line
   reliability-rules prose below the bibliography and confirm the page's
   phone screenshot is navigable. (Low priority; skip if time-boxed.)

**Acceptance**
- `du -sh app/public/brand` ≤ 600 KB; `ui-audit.cjs` "images over 150 KB"
  empty on every route including `/` (now rendering).
- Phone screenshot of `/` shows no layout shift artefacts (logo box reserved).

### Phase 9 — Code health

1. Move the 30 operational scripts: `git mv app/*.mjs app/scripts/` (keep
   `next.config.js` where it is). Then fix the six `import.meta.url`
   resolutions (they are one directory deeper): `new URL("../data/",
   import.meta.url)` → `"../../data/"`; `"../data/sources/registry.json"`,
   `"../data/hops/"`, `"../data/fermentables/"` likewise; `"../"` → `"../../"`;
   `"./sources-budget.json"` / `"./diastatic-budget.json"` → `"../…"` (the
   budget files stay in `app/` root — they are ratchets, not scripts). Update
   `package.json`: `build` → `node scripts/build-picker-data.mjs && prisma
   generate && next build`; `space-audit` path likewise. Update every doc and
   comment that names a script (`grep -rn "\.mjs" ../docs ../README.md
   app next.config.js lib`). Run each validator once from its new home:
   `node scripts/validate-sources.mjs`, `validate-diastatic.mjs`,
   `validate-must.mjs`, `validate-water.mjs`, `validate-yeasts.mjs`,
   `validate-hops.mjs`, `validate-guidelines.mjs`, `validate-prices.mjs` —
   all must pass exactly as before. Loaders that need the database are not
   run; only check they parse (`node --check`).
2. ESLint: `npm i -D eslint@8 eslint-config-next@14`; `.eslintrc.json`
   `{"extends": "next/core-web-vitals"}`; script `"lint": "next lint"`. Fix
   what it reports (expect `react-hooks/exhaustive-deps` and `no-img-element`
   notes; the existing disable comments are fine). **Do not add a workflow.**
3. `lib/generated/*.json`: add a check in `scripts/build-picker-data.mjs`
   that, when run with `--check`, exits 1 if the regenerated output differs
   from the committed files (same idea as `derive-math-fixtures.py`); run it
   in the gate.
4. `lib/brewtoad-ref.ts`: keep (it is the documented reconstruction of the
   original calculator and has a test), but add a header comment stating it
   is reference-only and where the live equivalents are
   (`lib/brewing-calcs.ts`, `lib/recipe-engine.ts`).
5. Dedupe the `force-dynamic` explanatory comment: one full copy in
   `app/app/page.tsx`, one-line pointers elsewhere (grep the phrase "This
   page has no dynamic segment").
6. `types/` and `capacitor.config.json` are fine; leave them.

**Acceptance**
- `ls app/*.mjs | wc -l` = 0; `npm run lint` 0 errors; `npm run typecheck`
  clean; `npm test` ≥ 145; `npm run build` green; all validators pass from
  `app/scripts/`; `node scripts/build-picker-data.mjs --check` exits 0.

### Phase 10 — Documentation refresh

1. `README.md`: what WortHogg is now (archive + all-drinks builder +
   ingredient databases + guidelines + water + pitching + toolbox), the repo
   layout (`app/`, `app/scripts/`, `data/`, `scripts/`, `docs/`, `scraper/`),
   how to run: dev, test, typecheck, lint, build, the validators, the fixture
   regeneration, and the UI audit gate. State the no-database-at-build rule
   and the provenance standard in two sentences each.
2. `docs/README.md` (new): one-paragraph index of every doc with its date and
   whether it is current or historical. Mark `hosting-decision.md`,
   `storage-efficiency.md`, `calculator-formulas.md`, `pitching-formulas.md`
   current; flag any that describe removed behaviour.
3. `docs/ui-overhaul-plan.md` (this file): append a "Completed" table with the
   re-measured section 2 numbers and the commit for each phase.

**Acceptance:** a new contributor can go from clone to a passing gate using
only `README.md`.

---

## 4. The gate — run after every phase

```
cd /home/user/Everything-is-here./app
npx tsc --noEmit
npm test                                   # ≥ 145 passing, 0 failing
npx next build; echo "build exit=$?"       # must be 0; ignore the telemetry TypeError lines
node build-sources.mjs && node validate-sources.mjs      # from app/scripts/ after Phase 9
cd .. && python3 scripts/derive-math-fixtures.py >/dev/null && git diff --exit-code data/math-verified.json && cd app
(npx next start -p 3123 &) ; sleep 5
PW_EXE=/opt/pw-browsers/chromium node scripts/ui-audit.cjs http://localhost:3123 /tmp/ui-audit --strict
pgrep -f "[n]ext-server" | xargs -r kill
```

`--strict` will fail until Phase 4 (the `/` = 500 check) and Phase 3 (the
nav checks) land; until then run without `--strict` and compare the summary
against section 2 by hand. From Phase 4 onward the strict gate must pass
before every commit.

Commit per phase with a message that names the phase and quotes the
re-measured numbers (before → after). Push to
`claude/mr-malty-pitching-calculator-bh3ol0` with `git push -u origin
claude/mr-malty-pitching-calculator-bh3ol0`.

---

## 5. Explicitly out of scope

- Formulas, fixtures, unit constants, provenance data, source documents, the
  database schema, migrations, authentication, the takedown workflow, the
  service-worker caching policy beyond the one-line fix in Phase 7.
- The world-recipes content project (traditional ferments, public-domain
  brewing books, institute recipes into `/recipes`) — a separate plan.
- Any CI/GitHub Actions work.
- Any redesign of the visual identity: same palette, same mascot, same
  BrewToad-derived layout language. This plan makes what exists correct,
  consistent, accessible and fast; it does not restyle it.
