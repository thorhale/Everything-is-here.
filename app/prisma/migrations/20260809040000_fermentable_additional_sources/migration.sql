-- A record whose fields honestly come from two documents.
--
-- A sharp cider apple takes its acid and tannin from Long Ashton, which ran for
-- seventy years and never tabulated sugar, and its sugar from CoFID, which has
-- no tannin. One sourceUrl forces a choice between them, and whichever loses
-- ends up with numbers sitting under a citation that does not support them —
-- the exact failure this whole pass has been unpicking.

ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "additionalSources" JSONB;
