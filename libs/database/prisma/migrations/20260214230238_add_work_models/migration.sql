-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "type" TEXT NOT NULL,
    "tradition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkUnit" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "parentUnitId" TEXT,
    "type" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "title" TEXT,
    "contentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "sourceUnitId" TEXT NOT NULL,
    "bibleVerseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Work_type_idx" ON "Work"("type");

-- CreateIndex
CREATE INDEX "Work_tradition_idx" ON "Work"("tradition");

-- CreateIndex
CREATE INDEX "WorkUnit_workId_idx" ON "WorkUnit"("workId");

-- CreateIndex
CREATE INDEX "WorkUnit_parentUnitId_idx" ON "WorkUnit"("parentUnitId");

-- CreateIndex
CREATE INDEX "WorkUnit_type_idx" ON "WorkUnit"("type");

-- CreateIndex
CREATE INDEX "Reference_sourceUnitId_idx" ON "Reference"("sourceUnitId");

-- CreateIndex
CREATE INDEX "Reference_bibleVerseId_idx" ON "Reference"("bibleVerseId");

-- AddForeignKey
ALTER TABLE "WorkUnit" ADD CONSTRAINT "WorkUnit_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkUnit" ADD CONSTRAINT "WorkUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "WorkUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "WorkUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_bibleVerseId_fkey" FOREIGN KEY ("bibleVerseId") REFERENCES "BibleVerse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
