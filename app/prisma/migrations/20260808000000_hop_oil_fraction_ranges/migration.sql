-- Hop oil fractions become ranges, and sourceUrl becomes optional.
--
-- Every merchant publishes the oil fractions as a range ("Myrcene: 45 - 60%").
-- Storing one Float per fraction forced a midpoint to be invented for each, and
-- eighteen of those invented points turned out to fall outside the range the
-- cited sheet actually prints. A range cannot be wrong in that particular way.
--
-- sourceUrl loses NOT NULL because six records deliberately carry no source: a
-- regional crop (Cascade grown in Argentina, US-grown Tettnanger) has no
-- published analysis, and the sheet for the same variety grown elsewhere is not
-- one. Those records now hold no brewing values and no citation, which is the
-- honest shape for them; the alternative was leaving a citation that pointed at
-- a document about something else.

ALTER TABLE "Hop"
  ADD COLUMN IF NOT EXISTS "myrceneMin"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "myrceneMax"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "humuleneMin"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "humuleneMax"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "caryophylleneMin"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "caryophylleneMax"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "farneseneMin"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "farneseneMax"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "specSource"        TEXT;

ALTER TABLE "Hop" ALTER COLUMN "sourceUrl" DROP NOT NULL;

ALTER TABLE "Hop"
  DROP COLUMN IF EXISTS "myrcenePct",
  DROP COLUMN IF EXISTS "humulenePct",
  DROP COLUMN IF EXISTS "caryophyllenePct",
  DROP COLUMN IF EXISTS "farnescenePct";
