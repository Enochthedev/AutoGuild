-- CreateTable
CREATE TABLE "User" (
    "id" STRING NOT NULL,
    "username" STRING,
    "status" STRING NOT NULL DEFAULT 'active',
    "bannedAt" TIMESTAMP(3),
    "banReason" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" STRING NOT NULL,
    "platform" STRING NOT NULL,
    "platformId" STRING NOT NULL,
    "username" STRING,
    "userId" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" STRING NOT NULL,
    "platform" STRING NOT NULL,
    "platformId" STRING NOT NULL,
    "name" STRING,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" STRING NOT NULL,
    "platformId" STRING NOT NULL,
    "guildId" STRING NOT NULL,
    "name" STRING,
    "type" STRING,
    "currentMode" STRING,
    "modeData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" STRING NOT NULL,
    "action" STRING NOT NULL,
    "reason" STRING,
    "targetUserId" STRING NOT NULL,
    "moderatorId" STRING,
    "guildId" STRING,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" STRING NOT NULL,
    "content" STRING NOT NULL,
    "type" STRING NOT NULL,
    "source" JSONB,
    "importance" FLOAT8 NOT NULL DEFAULT 0.5,
    "tags" STRING[],
    "embedding" FLOAT8[],
    "weaviateId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledEvent" (
    "id" STRING NOT NULL,
    "guildId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "status" STRING NOT NULL,
    "actionType" STRING NOT NULL,
    "actionData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" STRING NOT NULL,
    "key" STRING NOT NULL,
    "count" INT4 NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyValue" (
    "key" STRING NOT NULL,
    "value" STRING NOT NULL,
    "guildId" STRING,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_platform_platformId_key" ON "Identity"("platform", "platformId");

-- CreateIndex
CREATE INDEX "Guild_platform_idx" ON "Guild"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_platform_platformId_key" ON "Guild"("platform", "platformId");

-- CreateIndex
CREATE INDEX "Channel_guildId_idx" ON "Channel"("guildId");

-- CreateIndex
CREATE INDEX "Channel_currentMode_idx" ON "Channel"("currentMode");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_guildId_platformId_key" ON "Channel"("guildId", "platformId");

-- CreateIndex
CREATE INDEX "ModerationLog_timestamp_idx" ON "ModerationLog"("timestamp");

-- CreateIndex
CREATE INDEX "ModerationLog_targetUserId_idx" ON "ModerationLog"("targetUserId");

-- CreateIndex
CREATE INDEX "ModerationLog_deletedAt_idx" ON "ModerationLog"("deletedAt");

-- CreateIndex
CREATE INDEX "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");

-- CreateIndex
CREATE INDEX "Memory_createdAt_idx" ON "Memory"("createdAt");

-- CreateIndex
CREATE INDEX "Memory_weaviateId_idx" ON "Memory"("weaviateId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
