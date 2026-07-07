# BrewToad recovery — research notes

BrewToad (brewtoad.com) was a Rails-based homebrew recipe site with a recipe calculator.
It shut down 2018-12-31. The live domain is now dead/parked. All data recovery goes
through the Internet Archive Wayback Machine (`web.archive.org`), which has substantial
coverage of the site.

## Confirmed via direct CDX/snapshot queries

- A single CDX query for `brewtoad.com` (domain match, `collapse=urlkey`) hit the API's
  100,000-row cap immediately. Within that capped sample alone:
  - ~49,000 distinct `/recipes/<slug>` HTML pages returned HTTP 200.
  - ~18,000 distinct `/recipes/<slug>.xml` BeerXML exports returned HTTP 200.
  - Real totals are higher — full enumeration needs path-prefix splitting and
    `resumeKey` pagination (see `scraper/cdx`).
- A large crawl appears to have happened in December 2018, days before shutdown —
  likely an Archive Team / Internet Archive save effort. These snapshots are the
  richest and most complete; prefer them over older 2012-2013 captures when a
  recipe has multiple snapshots.
- A real Dec-2018 recipe snapshot
  (`/web/20181212221018/https://www.brewtoad.com/recipes/2-row-vienna-lager`)
  was fetched and confirmed fully server-rendered HTML containing: title, style,
  Anticipated OG/FG/Plato/IBU/ABV, SRM/color, the exact IBU formula label used
  ("Hop IBU Formula Used: Rager"), full Fermentables/Hops/Yeast tables, brewer
  notes, and a comment list with usernames. No client-side JS needed to read it.
- The matching BeerXML export (`2-row-vienna-lager.xml`) was also archived and
  fetched cleanly as `application/xml`.
- `/assets/recipe_editor.js` (~16KB, several 2013 snapshots) is archived — this is
  the client-side calculator logic and is the source for recreating the actual
  gravity/IBU/color/ABV formulas rather than guessing them.
- `/generic-fermentables`, `/hops`, `/yeasts` — an ingredient reference section
  separate from user recipes — existed on the site; worth scraping to power the
  calculator's ingredient picker with real data (PPG, Lovibond, alpha acid,
  attenuation).
- `/brewers/<id>/recipes` and `/brewers/<id>/favorite_recipes` are archived per
  user — gives attribution and an alternate recipe-discovery path, since recipe
  slugs (e.g. `2-row-vienna-lager`, `001-punkin-blood`) are not sequentially
  enumerable.
- `recipes.json` / `brewers.json` are NOT usefully archived (only a 2025 parked-domain
  capture) — don't rely on a JSON API; HTML + BeerXML from Dec-2018 snapshots is
  the reliable path.

## Network notes (this environment)

- HTTPS to `web.archive.org` works fine for CDX queries and snapshot fetches.
- Plain HTTP to `web.archive.org` is blocked by egress policy in the dev sandbox
  (`x-block-reason: hostname_blocked`) — irrelevant, since HTTPS is all that's used.
- Arbitrary third-party domains (e.g. `brewtoadarchive.com`, an unrelated existing
  recovery attempt) are not reachable from this sandbox. This project depends only
  on `web.archive.org`.

## Prior art (context only, not directly reusable)

All prior community tools scraped the *live* site, which no longer exists:
- `github.com/matiaskorhonen/brewtoad-export` — Node + Puppeteer, per-user export
  to PDF/BeerXML/JSON, no pagination handling.
- `github.com/kleinschmidt/brewtoad-scrape.jl` — Julia, scraped HTML + BeerXML +
  brew logs per user, hit 403s directly so shelled out to `curl`.
- `brewtoadarchive.com`, `beercraft.app/brewtoad-recipe-recovery` — other existing
  recovery efforts, unreachable from this sandbox to inspect further.

## Implications for the pipeline

- Recipe discovery must come from CDX enumeration (and/or brewer recipe-listing
  pages), not ID/slug brute-forcing.
- Treat HTML as the primary parse source (larger coverage + attribution/comments
  BeerXML lacks); use BeerXML as a fallback and as a cross-check for the HTML
  parser's extracted ingredient data.
- Validate the recreated calculator against real "Anticipated" figures visible on
  archived recipe pages — that's the concrete acceptance bar, not a formula
  guessed from first principles.
