CREATE TABLE "CatalogSnapshot" (
    "id" TEXT NOT NULL,
    "clientVersion" INTEGER NOT NULL,
    "heroes" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogHead" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogHead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedBuild" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedBuild_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "clientVersion" INTEGER,
    "errorCode" TEXT,
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogHead_snapshotId_key" ON "CatalogHead"("snapshotId");
ALTER TABLE "CatalogHead" ADD CONSTRAINT "CatalogHead_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedBuild" ADD CONSTRAINT "SavedBuild_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CatalogSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
