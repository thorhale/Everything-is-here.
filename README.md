# WortHogg (unofficial, unaffiliated BrewToad archive)

A community effort to recover the recipe database and recipe calculator from
[BrewToad](http://www.brewtoad.com/) (shut down 2018-12-31) from the Internet
Archive Wayback Machine, and republish them as a free, public web app.

This project is not affiliated with the original BrewToad or its former
operators. Recipes are historical, community-contributed content preserved for
archival purposes, attributed to their original authors where known. See
`docs/legal-notes.md` for the takedown/removal process.

## Layout

- `scraper/` — Wayback CDX enumeration, rate-limited fetching, and HTML/BeerXML
  parsing into normalized recipe records.
- `data/` — pipeline artifacts (`cdx/`, `raw/` are gitignored; `parsed/` holds
  normalized output).
- `app/` — the web app (recipe browser, calculator, takedown flow).
- `docs/` — research notes, data model, calculator formula derivation, legal notes.

See `docs/research.md` for what's been verified about data availability, and the
project plan for the full milestone breakdown.
