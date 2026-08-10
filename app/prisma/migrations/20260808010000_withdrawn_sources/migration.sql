-- Record a source the publisher has withdrawn, instead of keeping a dead link.
--
-- Weyermann removed its Chit Malt and Emmer Malt pages, Briess retired its
-- 6-row brewers malt page, and Red Star took its entire wine-yeast section
-- down. In every case the figures came from the maker's own page, no successor
-- document exists anywhere retrievable, and the Internet Archive is not
-- reachable from this environment to cite a snapshot instead.
--
-- Three bad options and one adequate one. Keeping the dead URL leaves a
-- citation a reader cannot check and this project's own link audit reports as
-- rot. Swapping in the publisher's homepage is worse — it looks live while
-- supporting nothing, which is the exact debt sources-budget.json exists to
-- ratchet down. Deleting the records throws away real catalog entries over a
-- website reorganisation. So: the number stays, sourceUrl goes null, and the
-- withdrawn URL is recorded as what it is. The reader is told the maker
-- published this figure and has since taken the page down, which is true and
-- is more than a 404 tells them.

ALTER TABLE "Fermentable"  ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "YeastStrain"  ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "Fermentable"  ADD COLUMN IF NOT EXISTS "withdrawnSourceUrl" TEXT;
ALTER TABLE "YeastStrain"  ADD COLUMN IF NOT EXISTS "withdrawnSourceUrl" TEXT;
