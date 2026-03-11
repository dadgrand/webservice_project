ALTER TABLE "tests"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "tests_archivedAt_idx" ON "tests"("archivedAt");
