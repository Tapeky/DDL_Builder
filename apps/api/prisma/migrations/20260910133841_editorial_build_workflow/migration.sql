-- CreateTable
CREATE TABLE "EditorialBuild" (
    "id" TEXT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialBuildVersion" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "EditorialBuildVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialBuildStep" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "itemClassName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "EditorialBuildStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialBuildStepAlternative" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "itemClassName" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "EditorialBuildStepAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchChange" (
    "id" TEXT NOT NULL,
    "fromSnapshotId" TEXT,
    "toSnapshotId" TEXT NOT NULL,
    "fromClientVersion" INTEGER,
    "toClientVersion" INTEGER NOT NULL,
    "changedHeroes" JSONB NOT NULL,
    "changedItems" JSONB NOT NULL,
    "staleBuilds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditorialBuild_heroId_idx" ON "EditorialBuild"("heroId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialBuild_heroId_style_key" ON "EditorialBuild"("heroId", "style");

-- CreateIndex
CREATE INDEX "EditorialBuildVersion_buildId_snapshotId_isCurrent_idx" ON "EditorialBuildVersion"("buildId", "snapshotId", "isCurrent");

-- CreateIndex
CREATE INDEX "EditorialBuildVersion_snapshotId_status_idx" ON "EditorialBuildVersion"("snapshotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialBuildVersion_buildId_snapshotId_revision_key" ON "EditorialBuildVersion"("buildId", "snapshotId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialBuildStep_versionId_order_key" ON "EditorialBuildStep"("versionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialBuildStepAlternative_stepId_itemClassName_key" ON "EditorialBuildStepAlternative"("stepId", "itemClassName");

-- CreateIndex
CREATE INDEX "PatchChange_toSnapshotId_idx" ON "PatchChange"("toSnapshotId");

-- CreateIndex
CREATE INDEX "PatchChange_createdAt_idx" ON "PatchChange"("createdAt");

-- AddForeignKey
ALTER TABLE "EditorialBuildVersion" ADD CONSTRAINT "EditorialBuildVersion_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "EditorialBuild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialBuildVersion" ADD CONSTRAINT "EditorialBuildVersion_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialBuildStep" ADD CONSTRAINT "EditorialBuildStep_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EditorialBuildVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialBuildStepAlternative" ADD CONSTRAINT "EditorialBuildStepAlternative_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "EditorialBuildStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchChange" ADD CONSTRAINT "PatchChange_fromSnapshotId_fkey" FOREIGN KEY ("fromSnapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchChange" ADD CONSTRAINT "PatchChange_toSnapshotId_fkey" FOREIGN KEY ("toSnapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
