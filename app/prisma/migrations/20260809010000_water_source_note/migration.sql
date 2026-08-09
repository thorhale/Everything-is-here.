-- WaterProfile gains the same three fields Fermentable already has, for the
-- same reason: 41 of the 66 profiles were citing the Bru'n Water homepage, and
-- checking three of them against the cities' own published analyses found all
-- three wrong about that city. Munich's bicarbonate was stored at 200 mg/L
-- against a published 324, which is the number that sets residual alkalinity
-- and therefore every mash pH built on that profile.
--
-- sourceUrl becomes optional so a profile can say it has no source; unsourced
-- makes that state countable; sourceNote carries what the citation does not
-- reach — for Munich, that the utility's analysis is the current supply and not
-- the historic brewing water the city's styles were built on.

ALTER TABLE "WaterProfile" ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "WaterProfile" ADD COLUMN IF NOT EXISTS "sourceNote" TEXT;
ALTER TABLE "WaterProfile" ADD COLUMN IF NOT EXISTS "unsourced" BOOLEAN NOT NULL DEFAULT false;
