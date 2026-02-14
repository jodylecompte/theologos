-- CreateTable
CREATE TABLE "BibleBook" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "testament" TEXT NOT NULL,
    "canonicalOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibleChapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "canonicalOrderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibleVerse" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "verseNumber" INTEGER NOT NULL,
    "canonicalOrderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleVerse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibleTranslation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "year" INTEGER,
    "license" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibleTextSegment" (
    "id" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "segmentLabel" TEXT,
    "contentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleTextSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BibleBook_canonicalOrder_idx" ON "BibleBook"("canonicalOrder");

-- CreateIndex
CREATE INDEX "BibleBook_testament_idx" ON "BibleBook"("testament");

-- CreateIndex
CREATE INDEX "BibleChapter_canonicalOrderIndex_idx" ON "BibleChapter"("canonicalOrderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BibleChapter_bookId_chapterNumber_key" ON "BibleChapter"("bookId", "chapterNumber");

-- CreateIndex
CREATE INDEX "BibleVerse_canonicalOrderIndex_idx" ON "BibleVerse"("canonicalOrderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BibleVerse_chapterId_verseNumber_key" ON "BibleVerse"("chapterId", "verseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BibleTranslation_abbreviation_key" ON "BibleTranslation"("abbreviation");

-- CreateIndex
CREATE INDEX "BibleTranslation_abbreviation_idx" ON "BibleTranslation"("abbreviation");

-- CreateIndex
CREATE INDEX "BibleTextSegment_verseId_idx" ON "BibleTextSegment"("verseId");

-- CreateIndex
CREATE INDEX "BibleTextSegment_translationId_idx" ON "BibleTextSegment"("translationId");

-- CreateIndex
CREATE UNIQUE INDEX "BibleTextSegment_verseId_translationId_segmentIndex_key" ON "BibleTextSegment"("verseId", "translationId", "segmentIndex");

-- AddForeignKey
ALTER TABLE "BibleChapter" ADD CONSTRAINT "BibleChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BibleBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibleVerse" ADD CONSTRAINT "BibleVerse_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BibleChapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibleTextSegment" ADD CONSTRAINT "BibleTextSegment_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "BibleVerse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibleTextSegment" ADD CONSTRAINT "BibleTextSegment_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "BibleTranslation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
