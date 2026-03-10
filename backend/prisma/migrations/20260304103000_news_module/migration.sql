-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_media" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_isPinned_publishedAt_idx" ON "news"("isPinned", "publishedAt");
CREATE INDEX "news_authorId_idx" ON "news"("authorId");

-- CreateIndex
CREATE INDEX "news_media_newsId_order_idx" ON "news_media"("newsId", "order");

-- AddForeignKey
ALTER TABLE "news"
ADD CONSTRAINT "news_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_media"
ADD CONSTRAINT "news_media_newsId_fkey"
FOREIGN KEY ("newsId") REFERENCES "news"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
