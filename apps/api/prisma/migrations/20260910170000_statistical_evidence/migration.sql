-- CreateTable
CREATE TABLE "ReferencePlayer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "accountIds" JSONB NOT NULL,
    "heroIds" JSONB NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "verificationSource" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRun" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filterHash" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "rowCount" INTEGER,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsItemStat" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "itemId" BIGINT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "wins" BIGINT NOT NULL,
    "losses" BIGINT NOT NULL,
    "matches" BIGINT NOT NULL,
    "players" BIGINT NOT NULL,
    "avgBuyTimeS" DOUBLE PRECISION NOT NULL,
    "avgSellTimeS" DOUBLE PRECISION NOT NULL,
    "avgBuyTimeRelative" DOUBLE PRECISION NOT NULL,
    "avgSellTimeRelative" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AnalyticsItemStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferencePlayer_verificationStatus_region_idx" ON "ReferencePlayer"("verificationStatus", "region");

-- CreateIndex
CREATE INDEX "AnalyticsRun_snapshotId_metric_filterHash_idx" ON "AnalyticsRun"("snapshotId", "metric", "filterHash");

-- CreateIndex
CREATE INDEX "AnalyticsRun_snapshotId_status_idx" ON "AnalyticsRun"("snapshotId", "status");

-- CreateIndex
CREATE INDEX "AnalyticsRun_completedAt_idx" ON "AnalyticsRun"("completedAt");

-- CreateIndex
CREATE INDEX "AnalyticsItemStat_itemId_matches_idx" ON "AnalyticsItemStat"("itemId", "matches");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsItemStat_runId_itemId_bucket_key" ON "AnalyticsItemStat"("runId", "itemId", "bucket");

-- AddForeignKey
ALTER TABLE "AnalyticsRun" ADD CONSTRAINT "AnalyticsRun_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsItemStat" ADD CONSTRAINT "AnalyticsItemStat_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalyticsRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

