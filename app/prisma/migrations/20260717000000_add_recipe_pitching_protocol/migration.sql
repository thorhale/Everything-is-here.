-- CreateTable
CREATE TABLE "RecipePitchingProtocol" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "volumeUnit" TEXT NOT NULL,
    "og" DOUBLE PRECISION NOT NULL,
    "pitchType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "packs" DOUBLE PRECISION,
    "grams" DOUBLE PRECISION,
    "slurryMl" DOUBLE PRECISION,
    "yeastFractionPct" DOUBLE PRECISION,
    "ageDays" DOUBLE PRECISION,
    "decayModel" TEXT NOT NULL,
    "starterType" TEXT NOT NULL,
    "starterMl" DOUBLE PRECISION,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RecipePitchingProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipePitchingProtocol_recipeId_key" ON "RecipePitchingProtocol"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipePitchingProtocol" ADD CONSTRAINT "RecipePitchingProtocol_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
