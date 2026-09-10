-- CreateTable
CREATE TABLE "EditorialBuildInvestment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "EditorialBuildInvestment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalTagDefinition" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TacticalTagDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TacticalHeroProfile" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "TacticalHeroProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticalHeroTag" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tagKey" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "TacticalHeroTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditorialBuildInvestment_versionId_priority_idx" ON "EditorialBuildInvestment"("versionId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialBuildInvestment_versionId_branch_phase_threshold_key" ON "EditorialBuildInvestment"("versionId", "branch", "phase", "threshold");

-- CreateIndex
CREATE INDEX "TacticalHeroProfile_snapshotId_status_idx" ON "TacticalHeroProfile"("snapshotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TacticalHeroProfile_snapshotId_heroId_key" ON "TacticalHeroProfile"("snapshotId", "heroId");

-- CreateIndex
CREATE INDEX "TacticalHeroTag_tagKey_status_idx" ON "TacticalHeroTag"("tagKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TacticalHeroTag_profileId_tagKey_key" ON "TacticalHeroTag"("profileId", "tagKey");

-- AddForeignKey
ALTER TABLE "EditorialBuildInvestment" ADD CONSTRAINT "EditorialBuildInvestment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EditorialBuildVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalHeroProfile" ADD CONSTRAINT "TacticalHeroProfile_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalHeroTag" ADD CONSTRAINT "TacticalHeroTag_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TacticalHeroProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticalHeroTag" ADD CONSTRAINT "TacticalHeroTag_tagKey_fkey" FOREIGN KEY ("tagKey") REFERENCES "TacticalTagDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

