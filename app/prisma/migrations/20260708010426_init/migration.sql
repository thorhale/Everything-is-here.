-- CreateTable
CREATE TABLE "Brewer" (
    "id" TEXT NOT NULL,
    "originalUsername" TEXT NOT NULL,
    "profileUrl" TEXT,
    "sourceTimestamp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "styleName" TEXT,
    "og" DOUBLE PRECISION,
    "fg" DOUBLE PRECISION,
    "ibu" DOUBLE PRECISION,
    "srm" DOUBLE PRECISION,
    "abv" DOUBLE PRECISION,
    "ibuFormula" TEXT,
    "batchSizeDisplay" TEXT,
    "boilTimeDisplay" TEXT,
    "efficiencyDisplay" TEXT,
    "notesText" TEXT,
    "brewerId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceTimestamp" TEXT NOT NULL,
    "sourceDigest" TEXT,
    "parseSource" TEXT NOT NULL,
    "parseConfidence" DOUBLE PRECISION NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "takedownStatus" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeFermentable" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountDisplay" TEXT,
    "amountLb" DOUBLE PRECISION,
    "percent" TEXT,
    "maltster" TEXT,
    "use" TEXT,
    "ppg" DOUBLE PRECISION,
    "colorLovibond" DOUBLE PRECISION,
    "refUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeFermentable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeHop" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountDisplay" TEXT,
    "amountOz" DOUBLE PRECISION,
    "timeDisplay" TEXT,
    "timeMinutes" DOUBLE PRECISION,
    "use" TEXT,
    "form" TEXT,
    "alphaAcidPct" DOUBLE PRECISION,
    "refUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeHop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeYeast" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labProduct" TEXT,
    "attenuationPct" DOUBLE PRECISION,
    "refUrl" TEXT,

    CONSTRAINT "RecipeYeast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeMisc" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "use" TEXT,
    "time" TEXT,

    CONSTRAINT "RecipeMisc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeComment" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "originalCommentId" TEXT,
    "commenter" TEXT,
    "commenterProfileUrl" TEXT,
    "timestampDisplay" TEXT,
    "text" TEXT NOT NULL,
    "parentCommentId" TEXT,

    CONSTRAINT "RecipeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermentableRef" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ppg" DOUBLE PRECISION,
    "colorLovibond" DOUBLE PRECISION,
    "type" TEXT,
    "origin" TEXT,

    CONSTRAINT "FermentableRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HopRef" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alphaAcidPct" DOUBLE PRECISION,

    CONSTRAINT "HopRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YeastRef" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lab" TEXT,
    "attenuationPct" DOUBLE PRECISION,

    CONSTRAINT "YeastRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakedownRequest" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT,
    "brewerId" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requestReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "TakedownRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brewer_originalUsername_key" ON "Brewer"("originalUsername");

-- CreateIndex
CREATE INDEX "Brewer_originalUsername_idx" ON "Brewer"("originalUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_styleName_idx" ON "Recipe"("styleName");

-- CreateIndex
CREATE INDEX "Recipe_abv_idx" ON "Recipe"("abv");

-- CreateIndex
CREATE INDEX "Recipe_ibu_idx" ON "Recipe"("ibu");

-- CreateIndex
CREATE INDEX "Recipe_brewerId_idx" ON "Recipe"("brewerId");

-- CreateIndex
CREATE INDEX "RecipeFermentable_recipeId_idx" ON "RecipeFermentable"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeHop_recipeId_idx" ON "RecipeHop"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeYeast_recipeId_idx" ON "RecipeYeast"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeMisc_recipeId_idx" ON "RecipeMisc"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeComment_recipeId_idx" ON "RecipeComment"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "FermentableRef_externalId_key" ON "FermentableRef"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "HopRef_externalId_key" ON "HopRef"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "YeastRef_externalId_key" ON "YeastRef"("externalId");

-- CreateIndex
CREATE INDEX "TakedownRequest_status_idx" ON "TakedownRequest"("status");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_brewerId_fkey" FOREIGN KEY ("brewerId") REFERENCES "Brewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFermentable" ADD CONSTRAINT "RecipeFermentable_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeHop" ADD CONSTRAINT "RecipeHop_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeYeast" ADD CONSTRAINT "RecipeYeast_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMisc" ADD CONSTRAINT "RecipeMisc_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakedownRequest" ADD CONSTRAINT "TakedownRequest_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakedownRequest" ADD CONSTRAINT "TakedownRequest_brewerId_fkey" FOREIGN KEY ("brewerId") REFERENCES "Brewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
