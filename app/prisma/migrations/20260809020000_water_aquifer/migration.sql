-- The aquifer a brewery well draws, as distinct from what a utility delivers.
--
-- Historic brewing towns did not brew with town water. Burton's brewers sank
-- wells into the Sherwood Sandstone and London's drilled through the London
-- Clay into the Chalk, and the rock is the whole reason those towns brewed what
-- they brewed. Storing one row of ions under a city name hides which well it
-- came from and how wide the aquifer's own spread is — and the spread is the
-- point. BGS measures sulfate in the Sherwood Sandstone anywhere from under 2
-- to 1810 mg/L across 211 samples, so Burton's famous ~600 is one draw from a
-- distribution three orders of magnitude wide. That is why published Burton
-- profiles disagree with each other threefold.

ALTER TABLE "WaterProfile" ADD COLUMN IF NOT EXISTS "aquifer" JSONB;
