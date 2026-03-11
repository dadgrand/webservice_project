ALTER TABLE "courses"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "courses_archivedAt_idx" ON "courses"("archivedAt");
