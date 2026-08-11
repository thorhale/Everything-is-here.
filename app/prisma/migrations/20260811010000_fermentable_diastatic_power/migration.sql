-- Diastatic power, stored the way a derived number has to be stored here.
--
-- The catalogue held 23 diastatic-power figures. An audit against the documents
-- those records cite found that 22 of them were not the figure the document
-- printed: seven differed from a number that was right there in the sheet
-- (Briess Goldpils Vienna prints 95 °Lintner where the record said 60), thirteen
-- cited documents that carry no diastatic power at all (Weyermann publishes one
-- for a single malt in a 63-page catalogue; Crisp's sheets have no such row),
-- and two rested on withdrawn pages. Only Briess Brewers Malt matched.
--
-- That happened because a bare Float has nowhere to record what was published
-- or on which of the three scales, so nothing could ever check it. These columns
-- keep the maltster's printed string and its unit beside the derived °Lintner,
-- exactly as ppgBasis and the nutrition inputs sit beside a derived PPG, and
-- app/validate-diastatic.mjs compares the two on every run.
--
-- diastaticPowerBasis carries the weight. A null °Lintner is ambiguous in a way
-- that matters to a distiller: "this malt has no enzymes" and "nobody published
-- a figure" are the same empty column, and a mash-conversion check has to treat
-- them as opposites. The basis says which.

ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerMin" DOUBLE PRECISION;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerMax" DOUBLE PRECISION;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerAtLeast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerPublished" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerUnit" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerBasis" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticPowerNote" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "diastaticSpecSource" TEXT;
ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "alphaAmylaseDu" DOUBLE PRECISION;
