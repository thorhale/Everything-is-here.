# Shrinking the database

Neon's free tier is 512 MB. The database sits around 368 MB (~72%), and roughly
93.5% of that is the recipe archive. This is the plan for getting it down, in
the order worth doing it.

Numbers come from `app/storage-savings.mjs`, which measures real string
distributions in `data/parsed/m1_sample.jsonl` and scales them by the production
row counts. Re-run `app/neon-space-audit.mjs` against the live database to check
the estimate against reality.

## First: compression is not the answer, and it is worth knowing why

The instinct is "zip it" — enable compression and move on. For this data that
does nothing, and the reason is specific.

Postgres compresses a value only when it exceeds the TOAST threshold, about
2 KB. Every column in the recipe archive is a short string: an ingredient name,
a `"60 min"`, a `"Pellet"`, a URL. All of them sit far below the threshold, so
none of them is compressed today, and switching TOAST to LZ4 would change
nothing at all.

The database is not big because it holds compressible bulk. It is big because it
holds **redundancy**: a few hundred distinct ingredient names, four values of
`use`, three of `form`, and one fully reconstructible URL, each repeated across a
million rows. Redundancy is removed by restructuring, not by compressing.

That distinction sets the whole approach below: replace repeated values with
small integers, and delete anything derivable from a column already present.

## The changes, by size

Total estimate: **~119 MB of heap, about 32% of current usage.** Indexes on the
narrowed columns shrink on top of that, and narrower rows pack more per 8 KB
page, so the realised figure should be a little better.

**Status: steps 1 and 2 are implemented — 75.4 MB, the two largest and safest.**
Step 5 was investigated and withdrawn on evidence (see below). Steps 3 and 4
remain, and step 4 deliberately waits until the migration has actually run,
because it needs the headroom the migration creates.

| Reclaimed | Change | Risk |
|---|---|---|
| 23.6 MB | `RecipeFermentable.refUrl` → `refId int4` | none — proven reconstructible |
| 22.0 MB | `RecipeHop.refUrl` → `refId int4` | none |
| 12.7 MB | drop `RecipeFermentable.id` (orphaned cuid) | low |
| 11.2 MB | drop `RecipeHop.id` (orphaned cuid) | low |
| 6.2 MB | `RecipeFermentable.name` → lookup id | low |
| 5.9 MB | `RecipeYeast.refUrl` → `refId int4` | none |
| 5.9 MB | `RecipeFermentable` 3 × `float8`→`float4` | low |
| 5.2 MB | `RecipeHop` 3 × `float8`→`float4` | low |
| 4.7 MB | drop `Recipe.sourceUrl` (derived from slug) | none |
| 4.4 MB | `RecipeHop.name` → lookup id | low |
| 2.7 MB | `Recipe` 6 × `float8`→`float4` | low |
| 2.7 MB | drop `RecipeFermentable.percent` (derived) | low |
| ~10 MB | remaining dictionary columns (`use`, `form`, `maltster`, `timeDisplay`, yeast names) | low |

### 1. `refUrl` → `refId` — 51.5 MB, and it loses nothing — **IMPLEMENTED**

Code is in place; the SQL has not been run (see "Running step 1" below).

The single biggest win, and the safest, because the column is pure redundancy.

Every `ref_url` in the archive has the shape:

```
/web/<timestamp>/https://www.brewtoad.com/<path>/<id>
```

Checked across all 2,323 `ref_url` values in the sample:

- **100%** match that shape.
- The `<timestamp>` equals the recipe's own `html_timestamp` in **100%** of
  cases — and that is already stored as `Recipe.sourceTimestamp`.
- `<path>` takes exactly **three** values — `generic-fermentables`, `hops`,
  `yeasts` — each implied by which table the row is in.

So 55–68 bytes per row encode a single integer. Store `refId int4`, rebuild the
URL in the view layer from the parent recipe's timestamp plus the table's own
path constant. Nothing is lost, and the reconstruction is exact.

Do this one first.

#### Running step 1

`app/migrate-refid.mjs` does it, expand/contract so the app is never reading a
column that does not exist:

```
cd app
node --env-file=.neon.env migrate-refid.mjs expand     # add refId, backfill, verify
#   ... deploy the app ...
node --env-file=.neon.env migrate-refid.mjs contract   # drop refUrl, reclaim
```

`expand` only adds a column, so it is safe against the currently-live app. It
refuses to continue if any non-null `refUrl` failed to parse, printing the
offending values — so a production URL shape the sample did not show stops the
migration rather than silently nulling data. `check` reports the current state
of both columns without changing anything.

Do not run `contract` before the deploy: the running app would be selecting a
dropped column. Prisma tolerates the reverse (a column in the database it does
not know about), which is what makes the expand phase safe.

Two things are verified before this touches the database:

- `lib/brewtoad-ref.test.ts` round-trips **every** `ref_url` in the parse
  sample through parse → store int → rebuild, asserting byte-identical output.
- The regex the migration hands to Postgres was checked against the tested
  TypeScript parser across all 2,323 sample URLs: 100% agreement, zero
  mismatches. The two code paths cannot disagree about what an id is.

### 2. Drop the orphaned cuid `id` columns — 23.9 MB — **IMPLEMENTED**

`schema.prisma` recorded that these were demoted from primary key and kept only
so "existing code that reads `f.id` — React list keys, lookup maps — keeps
working". Auditing that claim found the entire surface was **two React keys** on
the recipe detail page. Nothing else read either column: not the BeerXML export,
not the search, nothing. Both now key on `sortOrder`, which is half the
composite primary key and therefore unique within a recipe.

The drop is folded into the same `contract` pass as step 1 rather than run
separately, which matters near the cap: each `VACUUM FULL` needs roughly the
table's size free, so doing both columns in one rewrite halves the peak space
the migration costs.

### 3. Dictionary-encode the repeated strings — ~22 MB

Replace the text with a small integer referencing a lookup table. The
cardinalities make the case by themselves: in the sample, `use` has 4 distinct
values across 1,196 fermentable rows, `form` has 3 across 1,168 hop rows, and
hop `name` has 92.

This is the change that costs something: reads need a join or a cached
in-process lookup map. The lookup tables are tiny (a few hundred rows, entirely
cacheable at process start), so in practice it is a map lookup rather than a
join. Worth doing, but after the two free wins above.

### 4. `float8` → `float4` — 14.3 MB

Brewing values carry at most four significant digits; `float4` holds about
seven. There is no precision to lose.

The catch: Postgres aligns `float8` on 8-byte boundaries. Narrowing columns
without reordering them can convert the saving into alignment padding and gain
nothing. Do this as part of a table rewrite that also orders columns widest
fixed-width first, then narrower, then variable-length last.

### 5. Derived columns — 7.4 MB — **WITHDRAWN, do not do this**

Both columns are arithmetically derivable, and both should stay anyway. The
check that settled it is worth keeping on record.

**`RecipeFermentable.percent` (2.7 MB) — recomputing would corrupt the
archive.** The theory was that percent is just `amountLb` over the bill total.
Measured against the parse sample, only **14%** of stored percentages come
within 0.05 points of a recomputation, and 0.3% are off by more than a full
percentage point — a stored `15.0%` against a computed `16.0%`, a `9.0%`
against `10.0%`. BrewToad rounded its own displayed figures, mostly to whole
numbers, and those are the figures the archive exists to preserve. The Recipe
model already states this principle for `og`/`fg`/`ibu`: they are "BrewToad's
own computed 'Anticipated' stats — not recomputed from ingredients". `percent`
is the same kind of value. Dropping it would replace what BrewToad showed with
what we calculate, on 86% of rows, invisibly.

**`Recipe.sourceUrl` (4.7 MB) — derivable, but it is the takedown citation of
record.** It is exactly `https://www.brewtoad.com/recipes/` plus `slug` in 100%
of the sample, so nothing would be lost mechanically. But `schema.prisma` notes
it "doubles as the citation a takedown claimant points at", and there is
evidentiary value in storing the literal URL that was archived rather than
recomputing it later from a column that could in principle be normalised. 4.7 MB
is 1.3% of the database and does not outweigh that.

Neither is a large saving, and the fidelity of the archive is the product.

## Ordering, and the one real constraint

The constraint is that **a table rewrite temporarily needs free space**.
`ALTER TABLE ... ALTER COLUMN TYPE`, and `VACUUM FULL`, build a new copy of the
table before dropping the old one — so at peak they need roughly double that
table's size available. At 72% full, a rewrite of the largest table could hit the
cap and fail partway.

So the order matters:

1. **`refUrl` → `refId`** on the three junction tables, largest first. Add the
   new column, backfill, drop the old, then `VACUUM FULL` that one table alone.
   Each step frees space for the next.
2. **Drop the orphaned cuid columns.** A plain `DROP COLUMN` is metadata-only
   and instant; the space comes back on the next rewrite of that table, so pair
   it with step 1's vacuum rather than doing a separate pass.
3. **Dictionary encoding**, one column at a time, biggest first.
4. **`float8` → `float4` with column reordering**, last — by then there is
   comfortable headroom for the rewrite.

Run `app/neon-space-audit.mjs` between steps. It is read-only.

## Capacity plan: fitting a lot more

Column-level tuning has a ceiling. Measured against the live database, here is
where the recipe archive's 270 MB of junction tables actually goes:

| | |
|---|---|
| 28 MB | Postgres row headers — 27 bytes × 1,092,461 rows, unavoidable *per row* |
| 27 MB | `recipeId` cuid, repeated on every child row |
| 24 MB | orphaned `id` cuid |
| 93 MB | indexes |
| **98 MB** | **actual ingredient data** |

**172 MB — 64% — is structural overhead, not data.** No amount of narrowing
columns touches most of it, because it is a cost per *row*, and there are a
million rows holding 98 MB of content.

That reframes the problem. The lever is not "make each row smaller", it is
"stop having a million rows".

### Tier 1 — finish the column work (~95 MB, gets to ~265 MB)

`refUrl` (46 MB, `reclaim-refurl.mjs`), the orphaned `id` columns (24 MB,
needs the deploy), then dictionary encoding and float narrowing (~36 MB
combined). Straightforward, no architecture change. This is the ceiling of
tinkering.

### Tier 2 — collapse the junction tables into the recipe row (~140 MB more)

Store each recipe's ingredients as one compact JSONB column on `Recipe`
instead of three child tables. A recipe averages 9 ingredient rows; folding
them into the parent turns 1,092,461 rows into 118,246.

That deletes the per-row overhead outright: all 93 MB of junction indexes, the
27 MB of repeated `recipeId`, the 24 MB of orphaned cuid, and ~25 MB of row
headers. Use array-of-arrays encoding rather than repeated JSON keys, or the
key names eat the gain.

The trade: ingredients stop being independently queryable in SQL. Check what
depends on that first — `/hops/[name]` and the archive-stats aggregations read
across all recipes' ingredients, so they would need precomputed rollups. Those
are already cached and could be built at load time.

### Tier 3 — the archive stops living in Postgres (~300 MB, the real answer)

The BrewToad archive is **read-only and never changes**. It is a published
dataset, not application state, and it is the wrong shape for a row store.

Keep in Postgres only what genuinely needs querying: a slim `Recipe` row for
search, filter and sort (id, slug, title, style, the five stats, brewer) —
roughly 34 MB with its indexes. Everything else, the full ingredient detail
read one recipe at a time on the detail page, becomes sharded static files
served from the CDN, exactly like the reference data already is.

That leaves Postgres at well under 100 MB and around 400 MB free — enough
headroom that the storage question stops being a question. It also makes the
archive survivable independent of any database, which is the project's founding
premise.

Cost: a file read instead of a query on the detail page, and a build step to
shard the data. Neither is hard; the pattern already exists in this repo.

### What not to do

Do not reach for compression (see the top of this document), and do not delete
archive data to make room. The archive existing is the point.

## If more is needed later

The structural option, not needed yet: the junction tables are only ever read
one recipe at a time, on the detail page. They could move out of Postgres
entirely into sharded static JSON — the pattern this project already uses for
the reference data — leaving Postgres holding just the `Recipe` row needed for
search, filtering and sorting. That would take the archive's ~344 MB down to
tens of megabytes and end the storage question permanently.

It is a bigger change and it trades a query for a file read, so it is worth
doing only if the ~119 MB above proves insufficient. Given that 119 MB takes
usage from 72% to roughly 49%, it should not be needed for a long while.
