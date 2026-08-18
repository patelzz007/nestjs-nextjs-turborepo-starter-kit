/*
  Warnings:

  - The primary key for the `telescope_annotations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `request_id` on the `telescope_annotations` table. All the data in the column will be lost.
  - Added the required column `requestId` to the `telescope_annotations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "clicks" ALTER COLUMN "clicked_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "email_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "impersonation_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "logs" ALTER COLUMN "timestamp" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "menu_item_permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "menu_item_roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "menu_items" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "permission_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_alerts" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_annotations" DROP CONSTRAINT "telescope_annotations_pkey",
DROP COLUMN "request_id",
ADD COLUMN     "requestId" TEXT NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ADD CONSTRAINT "telescope_annotations_pkey" PRIMARY KEY ("requestId");

-- AlterTable
ALTER TABLE "telescope_dumps" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_exceptions" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "first_seen_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "last_seen_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_jobs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_queries" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "telescope_requests" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "url_tags" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "urls" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "user_permissions" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "filename" VARCHAR(255) NOT NULL,
    "size_bytes" BIGINT,
    "checksum" VARCHAR(64),
    "error" TEXT,
    "compress_level" INTEGER NOT NULL DEFAULT 6,
    "tables_excluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requested_by" TEXT NOT NULL,
    "requested_by_name" VARCHAR(100),
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "completed_at" BIGINT,
    "expires_at" BIGINT,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backups_status_idx" ON "backups"("status");

-- CreateIndex
CREATE INDEX "backups_created_at_idx" ON "backups"("created_at");
