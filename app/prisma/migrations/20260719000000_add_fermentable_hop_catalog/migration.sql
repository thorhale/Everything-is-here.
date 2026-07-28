-- CreateTable
CREATE TABLE "Fermentable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "origin" TEXT,
    "ppg" DOUBLE PRECISION,
    "yieldPct" DOUBLE PRECISION,
    "colorLovibond" DOUBLE PRECISION,
    "requiresConversion" BOOLEAN NOT NULL DEFAULT false,
    "requiresGelatinization" BOOLEAN NOT NULL DEFAULT false,
    "diastaticPowerLintner" DOUBLE PRECISION,
    "fermentabilityPct" DOUBLE PRECISION,
    "maxBatchPct" DOUBLE PRECISION,
    "ppgBasis" TEXT,
    "servingSizeG" DOUBLE PRECISION,
    "totalCarbG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "uses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "flavorNotes" TEXT,
    "usageNotes" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "attribution" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Fermentable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "purpose" TEXT,
    "alphaMin" DOUBLE PRECISION,
    "alphaMax" DOUBLE PRECISION,
    "betaMin" DOUBLE PRECISION,
    "betaMax" DOUBLE PRECISION,
    "cohumuloneMin" DOUBLE PRECISION,
    "cohumuloneMax" DOUBLE PRECISION,
    "totalOilMin" DOUBLE PRECISION,
    "totalOilMax" DOUBLE PRECISION,
    "myrcenePct" DOUBLE PRECISION,
    "humulenePct" DOUBLE PRECISION,
    "caryophyllenePct" DOUBLE PRECISION,
    "farnescenePct" DOUBLE PRECISION,
    "aromaDescriptors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "substitutes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "breeder" TEXT,
    "yearReleased" INTEGER,
    "description" TEXT,
    "usageNotes" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "attribution" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Hop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fermentable_category_idx" ON "Fermentable"("category");
CREATE INDEX "Fermentable_name_idx" ON "Fermentable"("name");
CREATE INDEX "Fermentable_brand_idx" ON "Fermentable"("brand");
CREATE INDEX "Hop_country_idx" ON "Hop"("country");
CREATE INDEX "Hop_name_idx" ON "Hop"("name");
CREATE INDEX "Hop_purpose_idx" ON "Hop"("purpose");
