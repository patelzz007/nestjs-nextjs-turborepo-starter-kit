-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "RedirectType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST', 'MANAGE');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('USER', 'PROFILE', 'ROLE', 'PERMISSION', 'ADMIN_DASHBOARD', 'SYSTEM_SETTINGS', 'URL', 'TAG', 'API_KEY', 'ANALYTICS', 'AUDIT_LOG', 'REPORT', 'TELESCOPE', 'EMAIL', 'BACKUP');

-- CreateEnum
CREATE TYPE "MenuMatchType" AS ENUM ('ANY', 'ALL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" BIGINT,
    "provider" TEXT,
    "provider_id" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "monthly_url_limit" INTEGER NOT NULL DEFAULT 50,
    "monthly_click_limit" INTEGER NOT NULL DEFAULT 10000,
    "email_verified_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "resource" "PermissionResource" NOT NULL,
    "description" TEXT,
    "group" VARCHAR(100),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_role_id" TEXT,
    "permission_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "icon" VARCHAR(50),
    "path" VARCHAR(255),
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_permissions" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "match_type" "MenuMatchType" NOT NULL DEFAULT 'ANY',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "menu_item_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_roles" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "menu_item_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "used_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "assignedBy" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "assignedBy" TEXT,
    "expiresAt" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "assignedBy" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" VARCHAR(255),
    "ipAddress" VARCHAR(45),
    "expiresAt" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urls" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "short_code" TEXT NOT NULL,
    "custom_alias" TEXT,
    "original_url" TEXT NOT NULL,
    "title" TEXT,
    "redirect_type" "RedirectType" NOT NULL DEFAULT 'TEMPORARY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT,
    "click_limit" INTEGER,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_tags" (
    "id" TEXT NOT NULL,
    "url_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "url_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "url_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "device_type" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "os" TEXT,
    "browser" TEXT,
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "clicked_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updatedAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read', 'write']::TEXT[],
    "rate_limit_tier" TEXT NOT NULL DEFAULT 'standard',
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" BIGINT,
    "expires_at" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_audit_logs" (
    "id" TEXT NOT NULL,
    "impersonator_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "impersonation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "userId" TEXT,
    "correlation_id" TEXT,
    "metadata" JSONB,
    "duration_ms" INTEGER,
    "error_group" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timestamp" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key_usage_logs" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "response_time_ms" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "api_key_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL,
    "resend_id" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

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
    "errorCode" VARCHAR(32),
    "compress_level" INTEGER NOT NULL DEFAULT 6,
    "schema_only" BOOLEAN NOT NULL DEFAULT false,
    "tables_excluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requested_by" TEXT NOT NULL,
    "requested_by_name" VARCHAR(100),
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "completed_at" BIGINT,
    "expires_at" BIGINT,
    "verified_at" BIGINT,
    "verified_table_count" INTEGER,
    "restored_at" BIGINT,
    "restored_database" VARCHAR(63),

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_requests" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "user_id" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "query_string" TEXT,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "request_body" JSONB,
    "response_body" JSONB,
    "request_headers" JSONB,
    "spans" JSONB NOT NULL,
    "logs" JSONB,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_queries" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "operation" VARCHAR(20) NOT NULL,
    "query" TEXT NOT NULL,
    "params" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_exceptions" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "error_group" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "status_code" INTEGER,
    "path" TEXT,
    "method" VARCHAR(10),
    "user_id" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "first_seen_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "last_seen_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "telescope_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_dumps" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_dumps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_jobs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "duration_ms" INTEGER,
    "payload_size" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "correlation_id" TEXT,
    "enqueued_at" BIGINT NOT NULL,
    "started_at" BIGINT,
    "finished_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_alerts" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "job_name" TEXT,
    "method" VARCHAR(10) NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "snoozed_until" BIGINT,
    "fired_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telescope_annotations" (
    "requestId" TEXT NOT NULL,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "telescope_annotations_pkey" PRIMARY KEY ("requestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_parent_id_idx" ON "roles"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_resource_key" ON "permissions"("action", "resource");

-- CreateIndex
CREATE INDEX "permission_audit_logs_actor_id_idx" ON "permission_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_target_user_id_idx" ON "permission_audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_target_role_id_idx" ON "permission_audit_logs"("target_role_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_created_at_idx" ON "permission_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "menu_items_parent_id_idx" ON "menu_items"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_permissions_menu_item_id_permission_id_key" ON "menu_item_permissions"("menu_item_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_roles_menu_item_id_role_id_key" ON "menu_item_roles"("menu_item_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "urls_short_code_key" ON "urls"("short_code");

-- CreateIndex
CREATE UNIQUE INDEX "urls_custom_alias_key" ON "urls"("custom_alias");

-- CreateIndex
CREATE INDEX "urls_short_code_idx" ON "urls"("short_code");

-- CreateIndex
CREATE INDEX "urls_user_id_idx" ON "urls"("user_id");

-- CreateIndex
CREATE INDEX "urls_expires_at_idx" ON "urls"("expires_at");

-- CreateIndex
CREATE INDEX "urls_deleted_at_idx" ON "urls"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "url_tags_url_id_tag_id_key" ON "url_tags"("url_id", "tag_id");

-- CreateIndex
CREATE INDEX "clicks_url_id_idx" ON "clicks"("url_id");

-- CreateIndex
CREATE INDEX "clicks_clicked_at_idx" ON "clicks"("clicked_at");

-- CreateIndex
CREATE INDEX "clicks_url_id_clicked_at_idx" ON "clicks"("url_id", "clicked_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_deleted_at_idx" ON "api_keys"("deleted_at");

-- CreateIndex
CREATE INDEX "impersonation_audit_logs_impersonator_id_idx" ON "impersonation_audit_logs"("impersonator_id");

-- CreateIndex
CREATE INDEX "impersonation_audit_logs_target_user_id_idx" ON "impersonation_audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "impersonation_audit_logs_created_at_idx" ON "impersonation_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "logs_level_idx" ON "logs"("level");

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "logs_context_idx" ON "logs"("context");

-- CreateIndex
CREATE INDEX "logs_message_idx" ON "logs"("message");

-- CreateIndex
CREATE INDEX "logs_userId_idx" ON "logs"("userId");

-- CreateIndex
CREATE INDEX "logs_correlation_id_idx" ON "logs"("correlation_id");

-- CreateIndex
CREATE INDEX "logs_error_group_idx" ON "logs"("error_group");

-- CreateIndex
CREATE INDEX "api_key_usage_logs_api_key_id_idx" ON "api_key_usage_logs"("api_key_id");

-- CreateIndex
CREATE INDEX "api_key_usage_logs_api_key_id_created_at_idx" ON "api_key_usage_logs"("api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "api_key_usage_logs_created_at_idx" ON "api_key_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_template_key_idx" ON "email_logs"("template_key");

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- CreateIndex
CREATE INDEX "email_logs_resend_id_idx" ON "email_logs"("resend_id");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- CreateIndex
CREATE INDEX "backups_status_idx" ON "backups"("status");

-- CreateIndex
CREATE INDEX "backups_created_at_idx" ON "backups"("created_at");

-- CreateIndex
CREATE INDEX "backups_expires_at_idx" ON "backups"("expires_at");

-- CreateIndex
CREATE INDEX "backups_requested_by_idx" ON "backups"("requested_by");

-- CreateIndex
CREATE INDEX "telescope_requests_created_at_idx" ON "telescope_requests"("created_at");

-- CreateIndex
CREATE INDEX "telescope_requests_correlation_id_idx" ON "telescope_requests"("correlation_id");

-- CreateIndex
CREATE INDEX "telescope_queries_created_at_idx" ON "telescope_queries"("created_at");

-- CreateIndex
CREATE INDEX "telescope_queries_correlation_id_idx" ON "telescope_queries"("correlation_id");

-- CreateIndex
CREATE INDEX "telescope_exceptions_created_at_idx" ON "telescope_exceptions"("created_at");

-- CreateIndex
CREATE INDEX "telescope_exceptions_status_idx" ON "telescope_exceptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "telescope_exceptions_error_group_key" ON "telescope_exceptions"("error_group");

-- CreateIndex
CREATE INDEX "telescope_dumps_created_at_idx" ON "telescope_dumps"("created_at");

-- CreateIndex
CREATE INDEX "telescope_jobs_created_at_idx" ON "telescope_jobs"("created_at");

-- CreateIndex
CREATE INDEX "telescope_alerts_created_at_idx" ON "telescope_alerts"("created_at");

-- CreateIndex
CREATE INDEX "telescope_annotations_created_at_idx" ON "telescope_annotations"("created_at");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_permissions" ADD CONSTRAINT "menu_item_permissions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_permissions" ADD CONSTRAINT "menu_item_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_roles" ADD CONSTRAINT "menu_item_roles_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_roles" ADD CONSTRAINT "menu_item_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "urls" ADD CONSTRAINT "urls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_tags" ADD CONSTRAINT "url_tags_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_tags" ADD CONSTRAINT "url_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_audit_logs" ADD CONSTRAINT "impersonation_audit_logs_impersonator_id_fkey" FOREIGN KEY ("impersonator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_audit_logs" ADD CONSTRAINT "impersonation_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
