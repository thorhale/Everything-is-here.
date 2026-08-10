-- What the brewery says about its own water, where it says anything.
--
-- Guinness states on its own site that the liquor for St James's Gate comes
-- from the Wicklow Mountains and is not, and never has been, drawn from the
-- Liffey. GSI characterises that ground as soft, weakly mineralised water at
-- 130-220 microsiemens. The "Dublin" profile in circulation carries 319 mg/L
-- bicarbonate, which no water at that conductivity can hold — it is a Liffey
-- municipal supply crossing Kildare limestone, not Guinness's brewing liquor.
--
-- That matters beyond bookkeeping: the standard explanation for roasted barley
-- in stout is that it acidifies Dublin's hard, alkaline water. If the brewery
-- brews with soft mountain water, the reasoning runs backwards for the beer it
-- is usually used to explain.

ALTER TABLE "WaterProfile" ADD COLUMN IF NOT EXISTS "brewerySource" JSONB;
