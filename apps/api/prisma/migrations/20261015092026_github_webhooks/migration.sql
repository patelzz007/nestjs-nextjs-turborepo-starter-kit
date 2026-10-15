-- CreateTable
CREATE TABLE "github_webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "owner" VARCHAR(39) NOT NULL,
    "repository" VARCHAR(100) NOT NULL,
    "github_hook_id" BIGINT NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "deleted_by" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,

    CONSTRAINT "github_webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_webhook_deliveries" (
    "delivery_id" VARCHAR(64) NOT NULL,
    "event" VARCHAR(64) NOT NULL,
    "owner" VARCHAR(39) NOT NULL,
    "repository" VARCHAR(100) NOT NULL,
    "pull_request_number" INTEGER,
    "received_at" BIGINT NOT NULL,

    CONSTRAINT "github_webhook_deliveries_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateIndex
CREATE INDEX "github_webhook_subscriptions_created_by_idx" ON "github_webhook_subscriptions"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "github_webhook_subscriptions_owner_repository_key" ON "github_webhook_subscriptions"("owner", "repository");

-- CreateIndex
CREATE INDEX "github_webhook_deliveries_received_at_idx" ON "github_webhook_deliveries"("received_at");

-- AddForeignKey
ALTER TABLE "github_webhook_subscriptions" ADD CONSTRAINT "github_webhook_subscriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
