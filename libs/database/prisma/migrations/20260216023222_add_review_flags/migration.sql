-- AlterTable
ALTER TABLE "WorkUnit" ADD COLUMN     "flags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "WorkUnit_status_flags_idx" ON "WorkUnit"("status", "flags");
