-- Say what a citation does NOT support, and count what nothing supports.
--
-- The 86 fruit records carry Brix, juice yield, titratable acidity, dominant
-- acid, pH, pectin and tannin alongside sugar, and every one of them cited
-- USDA FoodData Central. USDA publishes sugar. It has never published any of
-- the other seven for any food. A single sourceUrl on that record implied a
-- backing for all of it.
--
-- sourceNote carries the boundary — the same field YeastStrain already has for
-- the same reason. unsourced marks a record whose numbers currently rest on
-- nothing at all, so the count is visible and can be ratcheted down instead of
-- sitting invisible behind a citation that looked fine.

ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "sourceNote" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "unsourced" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Fermentable_unsourced_idx" ON "Fermentable"("unsourced");
