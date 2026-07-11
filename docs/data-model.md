# Data model

Derived from the fields actually observed in parsed M1 sample output
(`data/parsed/m1_sample.jsonl`) plus the BeerXML cross-check fields. Mirrors
`app/prisma/schema.prisma`, which is the source of truth for types/constraints.

## `recipes`
One row per canonical recipe (`slug` is the stable key from the original
BrewToad URL). Numeric stat fields are stored as-parsed strings from the
display (`og`, `fg`, `ibu`, `srm`, `abv`) alongside normalized numeric
columns filled in during ingest (M3) for querying/filtering.

| field | source | notes |
|---|---|---|
| slug | HTML/XML | stable id, e.g. `2-row-vienna-lager` |
| title | HTML `<title>` | |
| style_name | HTML title / XML `STYLE/NAME` | cross-checked between sources |
| og, fg, ibu, srm, abv | HTML `.recipe-show--stats` | BrewToad's own computed "Anticipated" values |
| ibu_formula | HTML extended stats | expected constant "Tinseth" per `docs/calculator-formulas.md` |
| batch_size_display, boil_time_display, efficiency_display | HTML extended stats | |
| notes_text | HTML `.recipe-show--notes` | often a pasted export from other software (ProMash etc.) - free text, not authoritative for BrewToad's own stats |
| brewer_username | XML `BREWER` (fallback: HTML attribution if added later) | |
| source_url, source_timestamp | manifest selection | the exact Wayback snapshot used |
| source_digest | CDX row | for change detection / dedup |
| parse_source | scraper | `html`, `xml`, or `html+xml_crossvalidated` |
| parse_confidence | scraper | 0-1, see `scraper/parse/html_parser.py` |
| is_hidden / takedown_status | app | set by approved takedown requests |

## `recipe_fermentables` / `recipe_hops` / `recipe_yeast`
Line items per recipe, one row per ingredient entry (order preserved).
Populated primarily from the HTML ingredient tables (`amount_display`,
`name`, `use`, `ppg`/`alpha_acid`/`attenuation`, `color_lovibond`,
`ref_url` linking to the ingredient reference tables below), cross-checked
against the BeerXML `AMOUNT`/`ALPHA`/`POTENTIAL`/`ATTENUATION` fields where
available.

## `recipe_comments`
One row per individual comment (threads flattened, `parent_comment_id`
preserves structure). Fields: `comment_id` (original BrewToad id),
`commenter`, `commenter_profile_url`, `timestamp_display`, `text`,
`parent_comment_id`. Confirmed via real archived data
(`scraper/parse/html_parser.py::_parse_comments`) that BrewToad rendered
comments as nested `<li class="recipe-comment" id="recipe-comment-N">`
regardless of thread depth, each carrying its own author/time/body.

## `fermentables_ref` / `hops_ref` / `yeasts_ref`
The separate ingredient reference database (`/generic-fermentables/<id>`,
`/hops/<id>`, `/yeasts/<id>` pages) — scraped once, referenced by
`ref_url`/id from recipe line items. Populates the calculator's ingredient
picker (M6). Not yet scraped as of M1 - planned for early M2.

## `takedown_requests`
`id, recipe_id (nullable), brewer_id (nullable), requester_name,
requester_email, request_reason, status, submitted_at, resolved_at,
resolved_by, notes`. Approving a request sets `recipes.is_hidden = true`
rather than deleting the row (audit trail preserved per `docs/legal-notes.md`).
