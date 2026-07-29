-- Sugar-mass and must-chemistry columns on Fermentable. Beer sizes a grain
-- bill from PPG and mash efficiency; wine, cider and mead size it from the
-- sugar actually present, which for real fruit is a range, not a number.
ALTER TABLE "Fermentable"
  ADD COLUMN IF NOT EXISTS "ppgMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ppgMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pfundColorMm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sugarGPer100g" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sugarGPer100gMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sugarGPer100gMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "juiceBrix" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "juiceBrixMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "juiceBrixMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "juiceYieldPct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "moisturePct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "titratableAcidityGPerL" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "titratableAcidityMinGPerL" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "titratableAcidityMaxGPerL" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dominantAcid" TEXT,
  ADD COLUMN IF NOT EXISTS "phTypical" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "phMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "phMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pectinLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "tanninLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "fruitGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "species" TEXT,
  ADD COLUMN IF NOT EXISTS "grapeColor" TEXT;

CREATE INDEX IF NOT EXISTS "Fermentable_fruitGroup_idx" ON "Fermentable"("fruitGroup");

-- Everything that goes in the fermenter without contributing sugar.
CREATE TABLE IF NOT EXISTS "Additive" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "category" TEXT NOT NULL,
  "subtype" TEXT,
  "uses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "doseMinGPerL" DOUBLE PRECISION,
  "doseMaxGPerL" DOUBLE PRECISION,
  "doseUnit" TEXT,
  "effectMetric" TEXT,
  "effectPerGramPerLitre" DOUBLE PRECISION,
  "effectUnit" TEXT,
  "contactTime" TEXT,
  "description" TEXT NOT NULL,
  "usageNotes" TEXT,
  "cautions" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "attribution" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Additive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Additive_category_idx" ON "Additive"("category");
CREATE INDEX IF NOT EXISTS "Additive_name_idx" ON "Additive"("name");
