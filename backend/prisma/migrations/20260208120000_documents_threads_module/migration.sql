-- AlterTable
ALTER TABLE "documents"
ADD COLUMN "threadId" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_threads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'distribution',
    "distributionType" TEXT NOT NULL DEFAULT 'individual',
    "status" TEXT NOT NULL DEFAULT 'new',
    "requiresReadReceipt" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_thread_recipients" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "decision" TEXT,
    "decisionComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_thread_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_thread_departments" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "document_thread_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_thread_groups" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "document_thread_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_recipient_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_recipient_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_recipient_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_recipient_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approval_actions" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_threadId_idx" ON "documents"("threadId");

-- CreateIndex
CREATE INDEX "document_threads_createdById_idx" ON "document_threads"("createdById");
CREATE INDEX "document_threads_status_idx" ON "document_threads"("status");
CREATE INDEX "document_threads_mode_idx" ON "document_threads"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "document_thread_recipients_threadId_userId_key" ON "document_thread_recipients"("threadId", "userId");
CREATE INDEX "document_thread_recipients_userId_isRead_idx" ON "document_thread_recipients"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "document_thread_departments_threadId_departmentId_key" ON "document_thread_departments"("threadId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_thread_groups_threadId_groupId_key" ON "document_thread_groups"("threadId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "document_recipient_groups_createdById_name_key" ON "document_recipient_groups"("createdById", "name");
CREATE INDEX "document_recipient_groups_createdById_idx" ON "document_recipient_groups"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "document_recipient_group_members_groupId_userId_key" ON "document_recipient_group_members"("groupId", "userId");
CREATE INDEX "document_recipient_group_members_userId_idx" ON "document_recipient_group_members"("userId");

-- CreateIndex
CREATE INDEX "document_approval_actions_threadId_createdAt_idx" ON "document_approval_actions"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "documents"
ADD CONSTRAINT "documents_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "document_threads"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_threads"
ADD CONSTRAINT "document_threads_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_recipients"
ADD CONSTRAINT "document_thread_recipients_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "document_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_recipients"
ADD CONSTRAINT "document_thread_recipients_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_departments"
ADD CONSTRAINT "document_thread_departments_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "document_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_departments"
ADD CONSTRAINT "document_thread_departments_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_groups"
ADD CONSTRAINT "document_thread_groups_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "document_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_thread_groups"
ADD CONSTRAINT "document_thread_groups_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "document_recipient_groups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipient_groups"
ADD CONSTRAINT "document_recipient_groups_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipient_group_members"
ADD CONSTRAINT "document_recipient_group_members_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "document_recipient_groups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipient_group_members"
ADD CONSTRAINT "document_recipient_group_members_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_approval_actions"
ADD CONSTRAINT "document_approval_actions_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "document_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_approval_actions"
ADD CONSTRAINT "document_approval_actions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
