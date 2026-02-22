/*
  Warnings:

  - You are about to drop the column `tradition` on the `Work` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Work_tradition_idx";

-- AlterTable
ALTER TABLE "Work" DROP COLUMN "tradition";

-- CreateTable
CREATE TABLE "Tradition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tradition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_WorkTraditions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_WorkTraditions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tradition_slug_key" ON "Tradition"("slug");

-- CreateIndex
CREATE INDEX "Tradition_slug_idx" ON "Tradition"("slug");

-- CreateIndex
CREATE INDEX "Tradition_parentId_idx" ON "Tradition"("parentId");

-- CreateIndex
CREATE INDEX "_WorkTraditions_B_index" ON "_WorkTraditions"("B");

-- AddForeignKey
ALTER TABLE "Tradition" ADD CONSTRAINT "Tradition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Tradition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkTraditions" ADD CONSTRAINT "_WorkTraditions_A_fkey" FOREIGN KEY ("A") REFERENCES "Tradition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkTraditions" ADD CONSTRAINT "_WorkTraditions_B_fkey" FOREIGN KEY ("B") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
