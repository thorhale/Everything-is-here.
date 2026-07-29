-- Beverage classification for the beverage-first guidelines navigation, and a
-- source-type on editions so a judging guideline reads differently from a
-- statute. Additive and idempotent — safe to run against the live DB.
ALTER TABLE "GuidelineEdition" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "GuidelineCategory" ADD COLUMN IF NOT EXISTS "beverage" TEXT;
CREATE INDEX IF NOT EXISTS "GuidelineCategory_beverage_idx" ON "GuidelineCategory"("beverage");
