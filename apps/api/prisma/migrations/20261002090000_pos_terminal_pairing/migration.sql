-- POS terminal pairing: merchants register tills and pair them with a one-time code.

-- AlterTable
ALTER TABLE "organization_merchant_profiles" ADD COLUMN "require_registered_terminals" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organization_terminals"
ADD COLUMN "api_key_id" TEXT,
ADD COLUMN "created_by_user_id" TEXT,
ADD COLUMN "deleted_by" TEXT,
ADD COLUMN "last_seen_at" BIGINT,
ADD COLUMN "paired_at" BIGINT,
ADD COLUMN "pairing_code_expires_at" BIGINT,
ADD COLUMN "pairing_code_hash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "organization_terminals_api_key_id_key" ON "organization_terminals"("api_key_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_terminals_pairing_code_hash_key" ON "organization_terminals"("pairing_code_hash");

-- AddForeignKey
ALTER TABLE "organization_terminals" ADD CONSTRAINT "organization_terminals_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_terminals" ADD CONSTRAINT "organization_terminals_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "organization_api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
