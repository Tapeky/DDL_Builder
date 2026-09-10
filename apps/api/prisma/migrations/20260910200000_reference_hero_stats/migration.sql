-- CreateTable
CREATE TABLE "ReferenceStatRun" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "playerCount" INTEGER,
    "rowCount" INTEGER,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReferenceStatRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceHeroStat" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "referencePlayerId" TEXT NOT NULL,
    "accountId" BIGINT NOT NULL,
    "heroId" INTEGER NOT NULL,
    "matchesPlayed" BIGINT NOT NULL,
    "wins" BIGINT NOT NULL,
    "lastPlayed" INTEGER NOT NULL,
    "timePlayed" BIGINT NOT NULL,
    "killsPerMin" DOUBLE PRECISION NOT NULL,
    "deathsPerMin" DOUBLE PRECISION NOT NULL,
    "assistsPerMin" DOUBLE PRECISION NOT NULL,
    "networthPerMin" DOUBLE PRECISION NOT NULL,
    "damagePerMin" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ReferenceHeroStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferenceStatRun_snapshotId_heroId_status_completedAt_idx" ON "ReferenceStatRun"("snapshotId", "heroId", "status", "completedAt");

-- CreateIndex
CREATE INDEX "ReferenceHeroStat_referencePlayerId_heroId_matchesPlayed_idx" ON "ReferenceHeroStat"("referencePlayerId", "heroId", "matchesPlayed");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceHeroStat_runId_referencePlayerId_accountId_heroId_key" ON "ReferenceHeroStat"("runId", "referencePlayerId", "accountId", "heroId");

-- AddForeignKey
ALTER TABLE "ReferenceStatRun" ADD CONSTRAINT "ReferenceStatRun_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceHeroStat" ADD CONSTRAINT "ReferenceHeroStat_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReferenceStatRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceHeroStat" ADD CONSTRAINT "ReferenceHeroStat_referencePlayerId_fkey" FOREIGN KEY ("referencePlayerId") REFERENCES "ReferencePlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
