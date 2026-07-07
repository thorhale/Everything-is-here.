# Legal / ethical notes

Brief flags to keep in mind while building and before any public launch — not a
substitute for real legal review if this goes live at scale.

## Republishing third-party content

Recipes, brewer usernames, and comments are user-generated content from a
now-defunct site, being republished without the original authors' fresh consent.
Mitigations built into the plan:
- Every recipe carries a visible provenance notice ("Archived from brewtoad.com
  on [date] via Wayback Machine") rather than presenting the content as new.
- A public takedown/claim-removal request form (`/takedown`) plus an admin
  review queue lets any original author get their content hidden without
  needing to negotiate directly with us. Approved requests set an
  `is_hidden`/`takedown_status` flag rather than hard-deleting, preserving an
  internal audit trail.

## "BrewToad" name/branding

The name is likely still trademarked (or at least associated in the community's
mind) with the original site's owners, even though it's defunct. Recommendation:
present this project under a clearly differentiated name (e.g. "BrewToad
Archive") with a conspicuous "unofficial, unaffiliated historical archive"
disclaimer on every page — not as the original site reborn under the same brand.

## Wayback Machine usage

Bulk automated scraping of `web.archive.org` is technically permitted for
research/archival reuse, but the fetch stage should stay polite (low
concurrency, rate-limited, backoff on errors — see `scraper/fetch`) out of
respect for shared infrastructure. Skim the Internet Archive's terms of use
before running the full-scale (M2) scrape.
