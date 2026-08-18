-- AlterTable
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "errorCode" VARCHAR(32),
ADD COLUMN     "restored_at" BIGINT,
ADD COLUMN     "restored_database" VARCHAR(63),
ADD COLUMN     "schema_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" BIGINT,
ADD COLUMN     "verified_table_count" INTEGER,
ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
ALTER TABLE "telescope_annotations" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
