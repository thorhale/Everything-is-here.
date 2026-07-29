-- Re-key the two large recipe junction tables off their synthetic cuid
-- primary key onto the composite (recipeId, sortOrder).
--
-- Why: on a 0.5 GB Neon tier, the cuid primary-key indexes on these tables
-- were 37 MB (RecipeFermentable) and 33 MB (RecipeHop) of btree that nothing
-- ever queried -- every access is by recipeId. (recipeId, sortOrder) was
-- verified unique across all 513k / 453k rows before writing this. The new
-- composite PK doubles as the recipeId lookup index, so the old standalone
-- recipeId index is dropped too. Net reclaim ~71 MB, and every step is
-- rewrite-free (no table copy, no large temp space): the DROP CONSTRAINT
-- frees its index instantly, and ADD PRIMARY KEY only builds the smaller
-- composite index. The `id` column is retained (still cuid-defaulted) so
-- application code reading `.id` is unaffected; it is simply no longer
-- indexed.
--
-- Idempotent by design: safe to run more than once, and safe to run whether
-- or not the live DDL was already applied out-of-band.

DO $$
BEGIN
  -- RecipeFermentable ------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'RecipeFermentable_pkey'
               AND conrelid = '"RecipeFermentable"'::regclass
               AND (SELECT array_agg(attname::text ORDER BY attnum)
                    FROM pg_attribute
                    WHERE attrelid = conrelid AND attnum = ANY(conkey)) = ARRAY['id']) THEN
    ALTER TABLE "RecipeFermentable" DROP CONSTRAINT "RecipeFermentable_pkey";
    ALTER TABLE "RecipeFermentable"
      ADD CONSTRAINT "RecipeFermentable_pkey" PRIMARY KEY ("recipeId", "sortOrder");
  END IF;
  DROP INDEX IF EXISTS "RecipeFermentable_recipeId_idx";

  -- RecipeHop --------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'RecipeHop_pkey'
               AND conrelid = '"RecipeHop"'::regclass
               AND (SELECT array_agg(attname::text ORDER BY attnum)
                    FROM pg_attribute
                    WHERE attrelid = conrelid AND attnum = ANY(conkey)) = ARRAY['id']) THEN
    ALTER TABLE "RecipeHop" DROP CONSTRAINT "RecipeHop_pkey";
    ALTER TABLE "RecipeHop"
      ADD CONSTRAINT "RecipeHop_pkey" PRIMARY KEY ("recipeId", "sortOrder");
  END IF;
  DROP INDEX IF EXISTS "RecipeHop_recipeId_idx";
END $$;
