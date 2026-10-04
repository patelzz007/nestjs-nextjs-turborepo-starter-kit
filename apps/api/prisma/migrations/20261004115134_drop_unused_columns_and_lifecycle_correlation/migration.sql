/*
  Warnings:

  - You are about to drop the column `effective_until` on the `organization_entitlements` table. All the data in the column will be lost.
  - You are about to drop the column `attributes` on the `organization_memberships` table. All the data in the column will be lost.
  - You are about to drop the column `emergency_approved_by` on the `support_access_grants` table. All the data in the column will be lost.
  - You are about to drop the column `target_membership_id` on the `support_access_grants` table. All the data in the column will be lost.
  - You are about to drop the column `shard_key` on the `tenant_placements` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `url_tags` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `users` table. All the data in the column will be lost.
  - Made the column `correlation_id` on table `organization_lifecycle_events` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "users_provider_provider_id_key";

-- AlterTable
ALTER TABLE "organization_entitlements" DROP COLUMN "effective_until";

-- AlterTable
ALTER TABLE "organization_lifecycle_events" ALTER COLUMN "correlation_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "organization_memberships" DROP COLUMN "attributes";

-- AlterTable
ALTER TABLE "support_access_grants" DROP COLUMN "emergency_approved_by",
DROP COLUMN "target_membership_id";

-- AlterTable
ALTER TABLE "tenant_placements" DROP COLUMN "shard_key";

-- AlterTable
ALTER TABLE "url_tags" DROP COLUMN "deleted_at";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "provider",
DROP COLUMN "provider_id";
