-- CreateEnum
CREATE TYPE "WorkUnitStatus" AS ENUM ('AUTO', 'EDITED', 'REVIEWED');

-- AlterTable
ALTER TABLE "WorkUnit" ADD COLUMN     "editedText" TEXT,
ADD COLUMN     "status" "WorkUnitStatus" NOT NULL DEFAULT 'AUTO';

-- CreateIndex
CREATE INDEX "WorkUnit_workId_positionIndex_idx" ON "WorkUnit"("workId", "positionIndex");
