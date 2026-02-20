/*
  Warnings:

  - You are about to drop the column `pdfPath` on the `Work` table. All the data in the column will be lost.
  - You are about to drop the column `pdfPageNumber` on the `WorkUnit` table. All the data in the column will be lost.
  - Changed the type of `type` on the `Work` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `WorkUnit` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('creed', 'catechism', 'confession', 'book');

-- CreateEnum
CREATE TYPE "WorkUnitType" AS ENUM ('section', 'question', 'article', 'chapter', 'paragraph', 'heading', 'blockquote');

-- DropIndex
DROP INDEX "WorkUnit_status_flags_idx";

-- AlterTable
ALTER TABLE "Work" DROP COLUMN "pdfPath",
DROP COLUMN "type",
ADD COLUMN     "type" "WorkType" NOT NULL;

-- AlterTable
ALTER TABLE "WorkUnit" DROP COLUMN "pdfPageNumber",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "sourcePage" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "WorkUnitType" NOT NULL;

-- CreateIndex
CREATE INDEX "Work_type_idx" ON "Work"("type");

-- CreateIndex
CREATE INDEX "WorkUnit_type_idx" ON "WorkUnit"("type");

-- CreateIndex
CREATE INDEX "WorkUnit_status_idx" ON "WorkUnit"("status");

-- CreateIndex
CREATE INDEX "WorkUnit_sourcePage_idx" ON "WorkUnit"("sourcePage");
