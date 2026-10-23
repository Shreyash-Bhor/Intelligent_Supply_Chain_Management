CREATE TABLE "AssistantConversation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messages" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantConversation_userId_conversationId_key"
  ON "AssistantConversation"("userId", "conversationId");
CREATE INDEX "AssistantConversation_expiresAt_idx"
  ON "AssistantConversation"("expiresAt");
ALTER TABLE "AssistantConversation"
  ADD CONSTRAINT "AssistantConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AssistantRateLimit" (
  "bucketId" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AssistantRateLimit_pkey" PRIMARY KEY ("bucketId", "windowStart")
);
CREATE INDEX "AssistantRateLimit_windowStart_idx"
  ON "AssistantRateLimit"("windowStart");

ALTER TABLE "Address" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Address_userId_idempotencyKey_key" ON "Address"("userId", "idempotencyKey");
ALTER TABLE "Address" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT FALSE;
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" ASC) AS position
  FROM "Address"
)
UPDATE "Address" SET "isDefault" = TRUE WHERE "id" IN (SELECT "id" FROM ranked WHERE position = 1);
CREATE UNIQUE INDEX "Address_one_default_per_user_key" ON "Address"("userId") WHERE "isDefault" = TRUE;
