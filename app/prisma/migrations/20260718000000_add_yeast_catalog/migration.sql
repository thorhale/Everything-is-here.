-- CreateTable
CREATE TABLE "YeastLab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "url" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "YeastLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YeastStrain" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "productCode" TEXT,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "form" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "uses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attenuationMin" DOUBLE PRECISION,
    "attenuationMax" DOUBLE PRECISION,
    "tempMinF" DOUBLE PRECISION,
    "tempMaxF" DOUBLE PRECISION,
    "tempMinC" DOUBLE PRECISION,
    "tempMaxC" DOUBLE PRECISION,
    "flocculation" TEXT,
    "alcoholToleranceMin" DOUBLE PRECISION,
    "alcoholToleranceMax" DOUBLE PRECISION,
    "cellsPerUnit" DOUBLE PRECISION,
    "unitLabel" TEXT,
    "optimalPitchNote" TEXT,
    "isBlend" BOOLEAN NOT NULL DEFAULT false,
    "blendComponents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "flavorNotes" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "attribution" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "YeastStrain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YeastLab_country_idx" ON "YeastLab"("country");

-- CreateIndex
CREATE INDEX "YeastStrain_labId_idx" ON "YeastStrain"("labId");

-- CreateIndex
CREATE INDEX "YeastStrain_name_idx" ON "YeastStrain"("name");

-- CreateIndex
CREATE INDEX "YeastStrain_species_idx" ON "YeastStrain"("species");

-- AddForeignKey
ALTER TABLE "YeastStrain" ADD CONSTRAINT "YeastStrain_labId_fkey" FOREIGN KEY ("labId") REFERENCES "YeastLab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
