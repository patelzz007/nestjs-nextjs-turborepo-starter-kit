ALTER TABLE "users" ADD COLUMN "locked_until_epoch" BIGINT;
UPDATE "users" SET "locked_until_epoch" = (EXTRACT(EPOCH FROM "locked_until") * 1000)::bigint WHERE "locked_until" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "locked_until";
ALTER TABLE "users" RENAME COLUMN "locked_until_epoch" TO "locked_until";
ALTER TABLE "users" ADD COLUMN "email_verified_at_epoch" BIGINT;
UPDATE "users" SET "email_verified_at_epoch" = (EXTRACT(EPOCH FROM "email_verified_at") * 1000)::bigint WHERE "email_verified_at" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "email_verified_at";
ALTER TABLE "users" RENAME COLUMN "email_verified_at_epoch" TO "email_verified_at";
ALTER TABLE "users" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "users" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "deleted_at";
ALTER TABLE "users" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "users" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "users" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "users" DROP COLUMN "createdAt";
ALTER TABLE "users" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "users" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "users" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "users" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "users" DROP COLUMN "updatedAt";
ALTER TABLE "users" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "roles" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "roles" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "roles" DROP COLUMN "deleted_at";
ALTER TABLE "roles" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "roles" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "roles" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "roles" DROP COLUMN "createdAt";
ALTER TABLE "roles" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "roles" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "roles" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "roles" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "roles" DROP COLUMN "updatedAt";
ALTER TABLE "roles" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "roles" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "roles" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "permissions" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "permissions" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "permissions" DROP COLUMN "deleted_at";
ALTER TABLE "permissions" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "permissions" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "permissions" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "permissions" DROP COLUMN "createdAt";
ALTER TABLE "permissions" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "permissions" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "permissions" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "permissions" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "permissions" DROP COLUMN "updatedAt";
ALTER TABLE "permissions" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "permissions" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "permissions" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "permission_audit_logs" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "permission_audit_logs" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "permission_audit_logs" DROP COLUMN "deleted_at";
ALTER TABLE "permission_audit_logs" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "permission_audit_logs" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "permission_audit_logs" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "permission_audit_logs" DROP COLUMN "created_at";
ALTER TABLE "permission_audit_logs" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "permission_audit_logs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "permission_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "permission_audit_logs" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "permission_audit_logs" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "permission_audit_logs" DROP COLUMN "updated_at";
ALTER TABLE "permission_audit_logs" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "permission_audit_logs" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "permission_audit_logs" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "menu_items" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "menu_items" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "menu_items" DROP COLUMN "deleted_at";
ALTER TABLE "menu_items" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "menu_items" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "menu_items" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "menu_items" DROP COLUMN "createdAt";
ALTER TABLE "menu_items" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "menu_items" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "menu_items" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "menu_items" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "menu_items" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "menu_items" DROP COLUMN "updatedAt";
ALTER TABLE "menu_items" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "menu_items" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "menu_items" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "menu_item_permissions" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "menu_item_permissions" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "menu_item_permissions" DROP COLUMN "deleted_at";
ALTER TABLE "menu_item_permissions" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "menu_item_permissions" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "menu_item_permissions" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "menu_item_permissions" DROP COLUMN "createdAt";
ALTER TABLE "menu_item_permissions" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "menu_item_permissions" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "menu_item_permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "menu_item_permissions" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "menu_item_permissions" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "menu_item_permissions" DROP COLUMN "updatedAt";
ALTER TABLE "menu_item_permissions" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "menu_item_permissions" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "menu_item_permissions" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "menu_item_roles" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "menu_item_roles" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "menu_item_roles" DROP COLUMN "deleted_at";
ALTER TABLE "menu_item_roles" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "menu_item_roles" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "menu_item_roles" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "menu_item_roles" DROP COLUMN "createdAt";
ALTER TABLE "menu_item_roles" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "menu_item_roles" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "menu_item_roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "menu_item_roles" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "menu_item_roles" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "menu_item_roles" DROP COLUMN "updatedAt";
ALTER TABLE "menu_item_roles" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "menu_item_roles" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "menu_item_roles" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "password_reset_tokens" ADD COLUMN "expires_at_epoch" BIGINT;
UPDATE "password_reset_tokens" SET "expires_at_epoch" = (EXTRACT(EPOCH FROM "expires_at") * 1000)::bigint;
ALTER TABLE "password_reset_tokens" DROP COLUMN "expires_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "expires_at_epoch" TO "expires_at";
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expires_at" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN "used_at_epoch" BIGINT;
UPDATE "password_reset_tokens" SET "used_at_epoch" = (EXTRACT(EPOCH FROM "used_at") * 1000)::bigint WHERE "used_at" IS NOT NULL;
ALTER TABLE "password_reset_tokens" DROP COLUMN "used_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "used_at_epoch" TO "used_at";
ALTER TABLE "password_reset_tokens" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "password_reset_tokens" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "password_reset_tokens" DROP COLUMN "deleted_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "password_reset_tokens" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "password_reset_tokens" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "password_reset_tokens" DROP COLUMN "created_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "password_reset_tokens" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "password_reset_tokens" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "password_reset_tokens" DROP COLUMN "updated_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "password_reset_tokens" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "password_reset_tokens" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "user_roles" ADD COLUMN "assignedAt_epoch" BIGINT;
UPDATE "user_roles" SET "assignedAt_epoch" = (EXTRACT(EPOCH FROM "assignedAt") * 1000)::bigint;
ALTER TABLE "user_roles" DROP COLUMN "assignedAt";
ALTER TABLE "user_roles" RENAME COLUMN "assignedAt_epoch" TO "assignedAt";
ALTER TABLE "user_roles" ALTER COLUMN "assignedAt" SET NOT NULL;
ALTER TABLE "user_roles" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "user_roles" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "user_roles" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "user_roles" DROP COLUMN "deleted_at";
ALTER TABLE "user_roles" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "user_roles" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "user_roles" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "user_roles" DROP COLUMN "createdAt";
ALTER TABLE "user_roles" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "user_roles" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "user_roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "user_roles" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "user_roles" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "user_roles" DROP COLUMN "updatedAt";
ALTER TABLE "user_roles" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "user_roles" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "user_roles" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "user_permissions" ADD COLUMN "assignedAt_epoch" BIGINT;
UPDATE "user_permissions" SET "assignedAt_epoch" = (EXTRACT(EPOCH FROM "assignedAt") * 1000)::bigint;
ALTER TABLE "user_permissions" DROP COLUMN "assignedAt";
ALTER TABLE "user_permissions" RENAME COLUMN "assignedAt_epoch" TO "assignedAt";
ALTER TABLE "user_permissions" ALTER COLUMN "assignedAt" SET NOT NULL;
ALTER TABLE "user_permissions" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "user_permissions" ADD COLUMN "expiresAt_epoch" BIGINT;
UPDATE "user_permissions" SET "expiresAt_epoch" = (EXTRACT(EPOCH FROM "expiresAt") * 1000)::bigint WHERE "expiresAt" IS NOT NULL;
ALTER TABLE "user_permissions" DROP COLUMN "expiresAt";
ALTER TABLE "user_permissions" RENAME COLUMN "expiresAt_epoch" TO "expiresAt";
ALTER TABLE "user_permissions" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "user_permissions" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "user_permissions" DROP COLUMN "deleted_at";
ALTER TABLE "user_permissions" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "user_permissions" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "user_permissions" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "user_permissions" DROP COLUMN "createdAt";
ALTER TABLE "user_permissions" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "user_permissions" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "user_permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "user_permissions" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "user_permissions" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "user_permissions" DROP COLUMN "updatedAt";
ALTER TABLE "user_permissions" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "user_permissions" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "user_permissions" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "role_permissions" ADD COLUMN "assignedAt_epoch" BIGINT;
UPDATE "role_permissions" SET "assignedAt_epoch" = (EXTRACT(EPOCH FROM "assignedAt") * 1000)::bigint;
ALTER TABLE "role_permissions" DROP COLUMN "assignedAt";
ALTER TABLE "role_permissions" RENAME COLUMN "assignedAt_epoch" TO "assignedAt";
ALTER TABLE "role_permissions" ALTER COLUMN "assignedAt" SET NOT NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "role_permissions" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "role_permissions" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "role_permissions" DROP COLUMN "deleted_at";
ALTER TABLE "role_permissions" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "role_permissions" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "role_permissions" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "role_permissions" DROP COLUMN "createdAt";
ALTER TABLE "role_permissions" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "role_permissions" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "role_permissions" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "role_permissions" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "role_permissions" DROP COLUMN "updatedAt";
ALTER TABLE "role_permissions" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "role_permissions" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "refresh_tokens" ADD COLUMN "expiresAt_epoch" BIGINT;
UPDATE "refresh_tokens" SET "expiresAt_epoch" = (EXTRACT(EPOCH FROM "expiresAt") * 1000)::bigint;
ALTER TABLE "refresh_tokens" DROP COLUMN "expiresAt";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt_epoch" TO "expiresAt";
ALTER TABLE "refresh_tokens" ALTER COLUMN "expiresAt" SET NOT NULL;
ALTER TABLE "refresh_tokens" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "refresh_tokens" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "refresh_tokens" DROP COLUMN "deleted_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "refresh_tokens" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "refresh_tokens" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "refresh_tokens" DROP COLUMN "createdAt";
ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "refresh_tokens" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "refresh_tokens" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "refresh_tokens" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "refresh_tokens" DROP COLUMN "updatedAt";
ALTER TABLE "refresh_tokens" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "refresh_tokens" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "urls" ADD COLUMN "expires_at_epoch" BIGINT;
UPDATE "urls" SET "expires_at_epoch" = (EXTRACT(EPOCH FROM "expires_at") * 1000)::bigint WHERE "expires_at" IS NOT NULL;
ALTER TABLE "urls" DROP COLUMN "expires_at";
ALTER TABLE "urls" RENAME COLUMN "expires_at_epoch" TO "expires_at";
ALTER TABLE "urls" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "urls" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "urls" DROP COLUMN "deleted_at";
ALTER TABLE "urls" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "urls" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "urls" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "urls" DROP COLUMN "created_at";
ALTER TABLE "urls" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "urls" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "urls" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "urls" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "urls" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "urls" DROP COLUMN "updated_at";
ALTER TABLE "urls" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "urls" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "urls" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "tags" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "tags" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "tags" DROP COLUMN "deleted_at";
ALTER TABLE "tags" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "tags" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "tags" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "tags" DROP COLUMN "created_at";
ALTER TABLE "tags" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "tags" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "tags" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "tags" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "tags" DROP COLUMN "updated_at";
ALTER TABLE "tags" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "tags" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "url_tags" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "url_tags" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "url_tags" DROP COLUMN "deleted_at";
ALTER TABLE "url_tags" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "url_tags" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "url_tags" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "url_tags" DROP COLUMN "createdAt";
ALTER TABLE "url_tags" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "url_tags" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "url_tags" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "url_tags" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "url_tags" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "url_tags" DROP COLUMN "updatedAt";
ALTER TABLE "url_tags" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "url_tags" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "url_tags" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "clicks" ADD COLUMN "clicked_at_epoch" BIGINT;
UPDATE "clicks" SET "clicked_at_epoch" = (EXTRACT(EPOCH FROM "clicked_at") * 1000)::bigint;
ALTER TABLE "clicks" DROP COLUMN "clicked_at";
ALTER TABLE "clicks" RENAME COLUMN "clicked_at_epoch" TO "clicked_at";
ALTER TABLE "clicks" ALTER COLUMN "clicked_at" SET NOT NULL;
ALTER TABLE "clicks" ALTER COLUMN "clicked_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "clicks" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "clicks" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "clicks" DROP COLUMN "deleted_at";
ALTER TABLE "clicks" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "clicks" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "clicks" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "clicks" DROP COLUMN "createdAt";
ALTER TABLE "clicks" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "clicks" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "clicks" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "clicks" ADD COLUMN "updatedAt_epoch" BIGINT;
UPDATE "clicks" SET "updatedAt_epoch" = (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint;
ALTER TABLE "clicks" DROP COLUMN "updatedAt";
ALTER TABLE "clicks" RENAME COLUMN "updatedAt_epoch" TO "updatedAt";
ALTER TABLE "clicks" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "clicks" ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "api_keys" ADD COLUMN "last_used_at_epoch" BIGINT;
UPDATE "api_keys" SET "last_used_at_epoch" = (EXTRACT(EPOCH FROM "last_used_at") * 1000)::bigint WHERE "last_used_at" IS NOT NULL;
ALTER TABLE "api_keys" DROP COLUMN "last_used_at";
ALTER TABLE "api_keys" RENAME COLUMN "last_used_at_epoch" TO "last_used_at";
ALTER TABLE "api_keys" ADD COLUMN "expires_at_epoch" BIGINT;
UPDATE "api_keys" SET "expires_at_epoch" = (EXTRACT(EPOCH FROM "expires_at") * 1000)::bigint WHERE "expires_at" IS NOT NULL;
ALTER TABLE "api_keys" DROP COLUMN "expires_at";
ALTER TABLE "api_keys" RENAME COLUMN "expires_at_epoch" TO "expires_at";
ALTER TABLE "api_keys" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "api_keys" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "api_keys" DROP COLUMN "deleted_at";
ALTER TABLE "api_keys" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "api_keys" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "api_keys" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "api_keys" DROP COLUMN "created_at";
ALTER TABLE "api_keys" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "api_keys" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "api_keys" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "api_keys" DROP COLUMN "updated_at";
ALTER TABLE "api_keys" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "api_keys" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "impersonation_audit_logs" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "impersonation_audit_logs" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "impersonation_audit_logs" DROP COLUMN "created_at";
ALTER TABLE "impersonation_audit_logs" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "impersonation_audit_logs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "impersonation_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "logs" ADD COLUMN "timestamp_epoch" BIGINT;
UPDATE "logs" SET "timestamp_epoch" = (EXTRACT(EPOCH FROM "timestamp") * 1000)::bigint;
ALTER TABLE "logs" DROP COLUMN "timestamp";
ALTER TABLE "logs" RENAME COLUMN "timestamp_epoch" TO "timestamp";
ALTER TABLE "logs" ALTER COLUMN "timestamp" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "timestamp" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "logs" ADD COLUMN "createdAt_epoch" BIGINT;
UPDATE "logs" SET "createdAt_epoch" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint;
ALTER TABLE "logs" DROP COLUMN "createdAt";
ALTER TABLE "logs" RENAME COLUMN "createdAt_epoch" TO "createdAt";
ALTER TABLE "logs" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "api_key_usage_logs" ADD COLUMN "deleted_at_epoch" BIGINT;
UPDATE "api_key_usage_logs" SET "deleted_at_epoch" = (EXTRACT(EPOCH FROM "deleted_at") * 1000)::bigint WHERE "deleted_at" IS NOT NULL;
ALTER TABLE "api_key_usage_logs" DROP COLUMN "deleted_at";
ALTER TABLE "api_key_usage_logs" RENAME COLUMN "deleted_at_epoch" TO "deleted_at";
ALTER TABLE "api_key_usage_logs" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "api_key_usage_logs" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "api_key_usage_logs" DROP COLUMN "created_at";
ALTER TABLE "api_key_usage_logs" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "api_key_usage_logs" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "api_key_usage_logs" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "api_key_usage_logs" DROP COLUMN "updated_at";
ALTER TABLE "api_key_usage_logs" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "email_logs" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "email_logs" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "email_logs" DROP COLUMN "created_at";
ALTER TABLE "email_logs" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "email_logs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "email_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "email_logs" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "email_logs" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "email_logs" DROP COLUMN "updated_at";
ALTER TABLE "email_logs" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "email_logs" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "email_logs" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_requests" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_requests" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_requests" DROP COLUMN "created_at";
ALTER TABLE "telescope_requests" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_requests" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_requests" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_queries" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_queries" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_queries" DROP COLUMN "created_at";
ALTER TABLE "telescope_queries" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_queries" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_queries" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_exceptions" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_exceptions" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_exceptions" DROP COLUMN "created_at";
ALTER TABLE "telescope_exceptions" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_exceptions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_exceptions" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "telescope_exceptions" ADD COLUMN "first_seen_at_epoch" BIGINT;
UPDATE "telescope_exceptions" SET "first_seen_at_epoch" = (EXTRACT(EPOCH FROM "first_seen_at") * 1000)::bigint;
ALTER TABLE "telescope_exceptions" DROP COLUMN "first_seen_at";
ALTER TABLE "telescope_exceptions" RENAME COLUMN "first_seen_at_epoch" TO "first_seen_at";
ALTER TABLE "telescope_exceptions" ALTER COLUMN "first_seen_at" SET NOT NULL;
ALTER TABLE "telescope_exceptions" ALTER COLUMN "first_seen_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "telescope_exceptions" ADD COLUMN "last_seen_at_epoch" BIGINT;
UPDATE "telescope_exceptions" SET "last_seen_at_epoch" = (EXTRACT(EPOCH FROM "last_seen_at") * 1000)::bigint;
ALTER TABLE "telescope_exceptions" DROP COLUMN "last_seen_at";
ALTER TABLE "telescope_exceptions" RENAME COLUMN "last_seen_at_epoch" TO "last_seen_at";
ALTER TABLE "telescope_exceptions" ALTER COLUMN "last_seen_at" SET NOT NULL;
ALTER TABLE "telescope_exceptions" ALTER COLUMN "last_seen_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_dumps" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_dumps" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_dumps" DROP COLUMN "created_at";
ALTER TABLE "telescope_dumps" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_dumps" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_dumps" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_jobs" ADD COLUMN "enqueued_at_epoch" BIGINT;
UPDATE "telescope_jobs" SET "enqueued_at_epoch" = (EXTRACT(EPOCH FROM "enqueued_at") * 1000)::bigint;
ALTER TABLE "telescope_jobs" DROP COLUMN "enqueued_at";
ALTER TABLE "telescope_jobs" RENAME COLUMN "enqueued_at_epoch" TO "enqueued_at";
ALTER TABLE "telescope_jobs" ALTER COLUMN "enqueued_at" SET NOT NULL;
ALTER TABLE "telescope_jobs" ADD COLUMN "started_at_epoch" BIGINT;
UPDATE "telescope_jobs" SET "started_at_epoch" = (EXTRACT(EPOCH FROM "started_at") * 1000)::bigint WHERE "started_at" IS NOT NULL;
ALTER TABLE "telescope_jobs" DROP COLUMN "started_at";
ALTER TABLE "telescope_jobs" RENAME COLUMN "started_at_epoch" TO "started_at";
ALTER TABLE "telescope_jobs" ADD COLUMN "finished_at_epoch" BIGINT;
UPDATE "telescope_jobs" SET "finished_at_epoch" = (EXTRACT(EPOCH FROM "finished_at") * 1000)::bigint WHERE "finished_at" IS NOT NULL;
ALTER TABLE "telescope_jobs" DROP COLUMN "finished_at";
ALTER TABLE "telescope_jobs" RENAME COLUMN "finished_at_epoch" TO "finished_at";
ALTER TABLE "telescope_jobs" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_jobs" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_jobs" DROP COLUMN "created_at";
ALTER TABLE "telescope_jobs" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_jobs" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_jobs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_alerts" ADD COLUMN "snoozed_until_epoch" BIGINT;
UPDATE "telescope_alerts" SET "snoozed_until_epoch" = (EXTRACT(EPOCH FROM "snoozed_until") * 1000)::bigint WHERE "snoozed_until" IS NOT NULL;
ALTER TABLE "telescope_alerts" DROP COLUMN "snoozed_until";
ALTER TABLE "telescope_alerts" RENAME COLUMN "snoozed_until_epoch" TO "snoozed_until";
ALTER TABLE "telescope_alerts" ADD COLUMN "fired_at_epoch" BIGINT;
UPDATE "telescope_alerts" SET "fired_at_epoch" = (EXTRACT(EPOCH FROM "fired_at") * 1000)::bigint;
ALTER TABLE "telescope_alerts" DROP COLUMN "fired_at";
ALTER TABLE "telescope_alerts" RENAME COLUMN "fired_at_epoch" TO "fired_at";
ALTER TABLE "telescope_alerts" ALTER COLUMN "fired_at" SET NOT NULL;
ALTER TABLE "telescope_alerts" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_alerts" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_alerts" DROP COLUMN "created_at";
ALTER TABLE "telescope_alerts" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_alerts" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_alerts" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

ALTER TABLE "telescope_annotations" ADD COLUMN "updated_at_epoch" BIGINT;
UPDATE "telescope_annotations" SET "updated_at_epoch" = (EXTRACT(EPOCH FROM "updated_at") * 1000)::bigint;
ALTER TABLE "telescope_annotations" DROP COLUMN "updated_at";
ALTER TABLE "telescope_annotations" RENAME COLUMN "updated_at_epoch" TO "updated_at";
ALTER TABLE "telescope_annotations" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "telescope_annotations" ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
ALTER TABLE "telescope_annotations" ADD COLUMN "created_at_epoch" BIGINT;
UPDATE "telescope_annotations" SET "created_at_epoch" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint;
ALTER TABLE "telescope_annotations" DROP COLUMN "created_at";
ALTER TABLE "telescope_annotations" RENAME COLUMN "created_at_epoch" TO "created_at";
ALTER TABLE "telescope_annotations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "telescope_annotations" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;


CREATE INDEX IF NOT EXISTS "roles_parent_id_idx" ON "roles" ("parent_id");


CREATE INDEX IF NOT EXISTS "permission_audit_logs_actor_id_idx" ON "permission_audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "permission_audit_logs_target_user_id_idx" ON "permission_audit_logs" ("target_user_id");
CREATE INDEX IF NOT EXISTS "permission_audit_logs_target_role_id_idx" ON "permission_audit_logs" ("target_role_id");
CREATE INDEX IF NOT EXISTS "permission_audit_logs_created_at_idx" ON "permission_audit_logs" ("created_at");

CREATE INDEX IF NOT EXISTS "menu_items_parent_id_idx" ON "menu_items" ("parent_id");



CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens" ("token");




CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens" ("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens" ("token");

CREATE INDEX IF NOT EXISTS "urls_short_code_idx" ON "urls" ("short_code");
CREATE INDEX IF NOT EXISTS "urls_user_id_idx" ON "urls" ("user_id");
CREATE INDEX IF NOT EXISTS "urls_expires_at_idx" ON "urls" ("expires_at");
CREATE INDEX IF NOT EXISTS "urls_deleted_at_idx" ON "urls" ("deleted_at");



CREATE INDEX IF NOT EXISTS "clicks_url_id_idx" ON "clicks" ("url_id");
CREATE INDEX IF NOT EXISTS "clicks_clicked_at_idx" ON "clicks" ("clicked_at");
CREATE INDEX IF NOT EXISTS "clicks_url_id_clicked_at_idx" ON "clicks" ("url_id", "clicked_at");

CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_deleted_at_idx" ON "api_keys" ("deleted_at");

CREATE INDEX IF NOT EXISTS "impersonation_audit_logs_impersonator_id_idx" ON "impersonation_audit_logs" ("impersonator_id");
CREATE INDEX IF NOT EXISTS "impersonation_audit_logs_target_user_id_idx" ON "impersonation_audit_logs" ("target_user_id");
CREATE INDEX IF NOT EXISTS "impersonation_audit_logs_created_at_idx" ON "impersonation_audit_logs" ("created_at");

CREATE INDEX IF NOT EXISTS "logs_level_idx" ON "logs" ("level");
CREATE INDEX IF NOT EXISTS "logs_timestamp_idx" ON "logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "logs_context_idx" ON "logs" ("context");
CREATE INDEX IF NOT EXISTS "logs_message_idx" ON "logs" ("message");
CREATE INDEX IF NOT EXISTS "logs_userId_idx" ON "logs" ("userId");
CREATE INDEX IF NOT EXISTS "logs_correlation_id_idx" ON "logs" ("correlation_id");
CREATE INDEX IF NOT EXISTS "logs_error_group_idx" ON "logs" ("error_group");

CREATE INDEX IF NOT EXISTS "api_key_usage_logs_api_key_id_idx" ON "api_key_usage_logs" ("api_key_id");
CREATE INDEX IF NOT EXISTS "api_key_usage_logs_api_key_id_created_at_idx" ON "api_key_usage_logs" ("api_key_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_key_usage_logs_created_at_idx" ON "api_key_usage_logs" ("created_at");

CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs" ("status");
CREATE INDEX IF NOT EXISTS "email_logs_template_key_idx" ON "email_logs" ("template_key");
CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs" ("to");
CREATE INDEX IF NOT EXISTS "email_logs_resend_id_idx" ON "email_logs" ("resend_id");
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" ("created_at");

CREATE INDEX IF NOT EXISTS "telescope_requests_created_at_idx" ON "telescope_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "telescope_requests_correlation_id_idx" ON "telescope_requests" ("correlation_id");

CREATE INDEX IF NOT EXISTS "telescope_queries_created_at_idx" ON "telescope_queries" ("created_at");
CREATE INDEX IF NOT EXISTS "telescope_queries_correlation_id_idx" ON "telescope_queries" ("correlation_id");

CREATE INDEX IF NOT EXISTS "telescope_exceptions_created_at_idx" ON "telescope_exceptions" ("created_at");
CREATE INDEX IF NOT EXISTS "telescope_exceptions_status_idx" ON "telescope_exceptions" ("status");

CREATE INDEX IF NOT EXISTS "telescope_dumps_created_at_idx" ON "telescope_dumps" ("created_at");

CREATE INDEX IF NOT EXISTS "telescope_jobs_created_at_idx" ON "telescope_jobs" ("created_at");

CREATE INDEX IF NOT EXISTS "telescope_alerts_created_at_idx" ON "telescope_alerts" ("created_at");

CREATE INDEX IF NOT EXISTS "telescope_annotations_created_at_idx" ON "telescope_annotations" ("created_at");

