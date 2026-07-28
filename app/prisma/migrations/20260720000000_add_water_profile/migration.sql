-- CreateTable
CREATE TABLE "WaterProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "calcium" DOUBLE PRECISION,
    "magnesium" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "chloride" DOUBLE PRECISION,
    "sulfate" DOUBLE PRECISION,
    "bicarbonate" DOUBLE PRECISION,
    "description" TEXT,
    "bestForStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "attribution" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WaterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaterProfile_kind_idx" ON "WaterProfile"("kind");
CREATE INDEX "WaterProfile_name_idx" ON "WaterProfile"("name");
