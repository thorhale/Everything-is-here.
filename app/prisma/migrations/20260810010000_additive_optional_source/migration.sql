-- Some additives are shelf categories, not products.
--
-- "Yeast energizer" is whatever a supplier chose to blend — DAP, autolyzed
-- yeast, thiamine, sometimes magnesium sulfate, in undisclosed proportions.
-- Irish moss and Sparkolloid appear in neither 27 CFR 24.246 nor either Scott
-- Laboratories handbook. Black tea as a tannin source has no specification at
-- all. A NOT NULL sourceUrl did not make those records sourced; it made them
-- point at a homepage that says nothing about them, which reads as provenance
-- and is not. Fermentable and WaterProfile already allow the honest answer.

ALTER TABLE "Additive" ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "Additive" ADD COLUMN IF NOT EXISTS "unsourced" BOOLEAN NOT NULL DEFAULT false;
