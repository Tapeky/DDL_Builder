-- CreateTable
CREATE TABLE "LeaderboardRun" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowCount" INTEGER,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LeaderboardRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "accountName" TEXT,
    "possibleAccountIds" JSONB NOT NULL,
    "rank" INTEGER,
    "topHeroIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "promotedPlayerId" TEXT,

    CONSTRAINT "LeaderboardCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardRun_snapshotId_heroId_region_idx" ON "LeaderboardRun"("snapshotId", "heroId", "region");

-- CreateIndex
CREATE INDEX "LeaderboardRun_status_completedAt_idx" ON "LeaderboardRun"("status", "completedAt");

-- CreateIndex
CREATE INDEX "LeaderboardCandidate_runId_status_idx" ON "LeaderboardCandidate"("runId", "status");

-- CreateIndex
CREATE INDEX "LeaderboardCandidate_accountName_idx" ON "LeaderboardCandidate"("accountName");

-- AddForeignKey
ALTER TABLE "LeaderboardRun" ADD CONSTRAINT "LeaderboardRun_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardCandidate" ADD CONSTRAINT "LeaderboardCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LeaderboardRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
