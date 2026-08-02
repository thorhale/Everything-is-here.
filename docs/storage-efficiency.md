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

### 1. `refUrl` → `refId` — 51.5 MB, and it loses nothing

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

### 2. Drop the orphaned cuid `id` columns — 23.9 MB

`schema.prisma` records that these were demoted from primary key and kept only
so "existing code that reads `f.id` — React list keys, lookup maps — keeps
working". The identity is now `(recipeId, sortOrder)`, which makes a perfectly
good React key. Grep for `.id` on these two models, switch the keys, drop the
columns.

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

### 5. Derived columns — 7.4 MB

`Recipe.sourceUrl` is `https://www.brewtoad.com/recipes/` plus `slug`, which is
already a column. `RecipeFermentable.percent` is computable from `amountLb`
against the bill total. Both are display conveniences that cost storage per row.

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
