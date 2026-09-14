-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "RedirectType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TwoFactorLoginChallengePurpose" AS ENUM ('LOGIN', 'ROTATE');

-- CreateEnum
CREATE TYPE "MfaRecoveryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST', 'MANAGE');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('USER', 'PROFILE', 'ROLE', 'PERMISSION', 'ADMIN_DASHBOARD', 'SYSTEM_SETTINGS', 'URL', 'TAG', 'API_KEY', 'ANALYTICS', 'AUDIT_LOG', 'REPORT', 'EMAIL', 'GEO', 'REWARD', 'MERCHANT_ORG', 'REDEMPTION', 'SAMPLE_CATEGORY', 'PRODUCT', 'DEVTOOLS');

-- CreateEnum
CREATE TYPE "CapabilityScope" AS ENUM ('PLATFORM', 'MERCHANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PilotCity" AS ENUM ('KUALA_LUMPUR', 'MELAKA');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "OrganizationLifecycleState" AS ENUM ('PROVISIONING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'POLICY_ADMIN', 'CASHIER');

-- CreateEnum
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "OrganizationLocationScopeType" AS ENUM ('ALL_LOCATIONS', 'SELECTED');

-- CreateEnum
CREATE TYPE "OrganizationLocationStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrganizationAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuthorizationPolicyScope" AS ENUM ('PLATFORM_GUARDRAIL', 'PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "AuthorizationPolicyStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "SupportAccessGrantMode" AS ENUM ('READ_ONLY', 'WRITE_ELEVATED');

-- CreateEnum
CREATE TYPE "SupportAccessGrantStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_TENANT_APPROVAL', 'ACTIVE', 'EXPIRED', 'REVOKED', 'DENIED');

-- CreateEnum
CREATE TYPE "TenantPlacementKind" AS ENUM ('SHARED', 'DEDICATED');

-- CreateEnum
CREATE TYPE "TenantEncryptionKeyStatus" AS ENUM ('ACTIVE', 'ROTATING', 'REVOKED');

-- CreateEnum
CREATE TYPE "KybDocumentScanStatus" AS ENUM ('SCANNING', 'CLEAN', 'INFECTED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'SCANNING', 'READY', 'FAILED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PRODUCT_IMAGE', 'STORE_LOGO', 'STORE_BANNER', 'USER_AVATAR', 'MERCHANT_KYB');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('local', 's3', 'firebase');

-- CreateEnum
CREATE TYPE "OrganizationAssetType" AS ENUM ('LOGO', 'BANNER');

-- CreateEnum
CREATE TYPE "FileVariantKind" AS ENUM ('ORIGINAL', 'THUMBNAIL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DISCOUNT', 'FREE_ITEM', 'CASHBACK', 'POINTS', 'BOGO');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('CONSUMER', 'REFERRER');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardRedemptionMethod" AS ENUM ('SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "RewardReferralStatus" AS ENUM ('PENDING', 'CREDITED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RewardOtpPurpose" AS ENUM ('CLAIM');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" BIGINT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_secret_ciphertext" TEXT,
    "two_factor_secret_iv" VARCHAR(32),
    "two_factor_secret_key_version" INTEGER,
    "two_factor_last_totp_step" BIGINT,
    "mfa_enrolled_at" BIGINT,
    "mfa_enrollment_deadline" BIGINT,
    "mfa_assured_at" BIGINT,
    "provider" TEXT,
    "provider_id" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "monthly_url_limit" INTEGER NOT NULL DEFAULT 50,
    "monthly_click_limit" INTEGER NOT NULL DEFAULT 10000,
    "email_verified_at" BIGINT,
    "phone" VARCHAR(20),
    "phone_verified_at" BIGINT,
    "last_login_at" BIGINT,
    "pending_attribution_token" VARCHAR(64),
    "pending_attribution_expires_at" BIGINT,
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
CREATE TABLE "capability_definitions" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "scope" "CapabilityScope" NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "group_name" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permission_id" TEXT,
    "metadata" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "capability_definitions_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "token_digest" VARCHAR(64),
    "expires_at" BIGINT NOT NULL,
    "used_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_pending_setups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" VARCHAR(32) NOT NULL,
    "secret_key_version" INTEGER NOT NULL,
    "backup_codes_hashes" JSONB NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "two_factor_pending_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_login_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "TwoFactorLoginChallengePurpose" NOT NULL,
    "client_type" TEXT,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "consumed_at" BIGINT,
    "expires_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "two_factor_login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "MfaRecoveryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" BIGINT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" BIGINT,
    "scheduled_unlock_at" BIGINT,
    "completed_at" BIGINT,
    "notes" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "mfa_recovery_requests_pkey" PRIMARY KEY ("id")
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
    "previous_token_hash" TEXT,
    "rotation_version" INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT '2014-01-01 12:01:01',
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subregions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT '2014-01-01 12:01:01',
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region_id" INTEGER NOT NULL,

    CONSTRAINT "subregions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "iso3" VARCHAR(3),
    "numeric_code" VARCHAR(3),
    "iso2" VARCHAR(2),
    "phonecode" VARCHAR(255),
    "capital" VARCHAR(255),
    "currency" VARCHAR(255),
    "currency_name" VARCHAR(255),
    "currency_symbol" VARCHAR(255),
    "tld" VARCHAR(255),
    "native" VARCHAR(255),
    "population" BIGINT,
    "gdp" BIGINT,
    "region" VARCHAR(255),
    "subregion" VARCHAR(255),
    "nationality" VARCHAR(255),
    "timezones" JSONB,
    "translations" JSONB,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "emoji" VARCHAR(191),
    "emojiU" VARCHAR(191),
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT '2014-01-01 12:01:01',
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region_id" INTEGER,
    "subregion_id" INTEGER,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "fips_code" VARCHAR(255),
    "iso2" VARCHAR(255),
    "iso3166_2" VARCHAR(255),
    "type" VARCHAR(191),
    "level" INTEGER,
    "parent_id" INTEGER,
    "native" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "timezone" VARCHAR(255),
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT '2014-01-01 12:01:01',
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "state_code" VARCHAR(255) NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "native" VARCHAR(255),
    "timezone" VARCHAR(255),
    "translations" JSONB,
    "wikiDataId" VARCHAR(255),
    "flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT '2014-01-01 12:01:01',
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "lifecycle_state" "OrganizationLifecycleState" NOT NULL DEFAULT 'PROVISIONING',
    "deletion_grace_ends_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_slug_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "reserved_until" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "address_text" TEXT,
    "city" "PilotCity",
    "contact_phone" VARCHAR(20),
    "status" "OrganizationLocationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rejection_reason" TEXT,
    "requested_by_user_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" BIGINT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationMembershipRole" NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" VARCHAR(100),
    "attributes" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_membership_location_scopes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "scope_type" "OrganizationLocationScopeType" NOT NULL,
    "location_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_membership_location_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_merchant_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "legal_name" VARCHAR(200),
    "category" VARCHAR(100) NOT NULL,
    "address_text" TEXT,
    "city" "PilotCity" NOT NULL,
    "kyb_status" "KybStatus" NOT NULL DEFAULT 'PENDING',
    "kyb_fields" JSONB,
    "contact_email" VARCHAR(100) NOT NULL,
    "contact_phone" VARCHAR(20),
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_merchant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "email" VARCHAR(100) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "intended_role" "OrganizationMembershipRole" NOT NULL,
    "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_admin_id" TEXT NOT NULL,
    "accepted_by_user_id" TEXT,
    "expires_at" BIGINT NOT NULL,
    "accepted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_access_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "OrganizationAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_lifecycle_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_state" "OrganizationLifecycleState",
    "to_state" "OrganizationLifecycleState" NOT NULL,
    "actor_user_id" TEXT,
    "reason" TEXT,
    "correlation_id" VARCHAR(64),
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_placements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "TenantPlacementKind" NOT NULL DEFAULT 'SHARED',
    "region_code" VARCHAR(32) NOT NULL DEFAULT 'default',
    "shard_key" VARCHAR(64),
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "tenant_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_entitlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_code" VARCHAR(64) NOT NULL,
    "features" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" BIGINT NOT NULL,
    "effective_until" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_quotas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "quota_key" VARCHAR(64) NOT NULL,
    "limit_value" BIGINT NOT NULL,
    "used_value" BIGINT NOT NULL DEFAULT 0,
    "window_start" BIGINT NOT NULL,
    "window_end" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_policy_drafts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "scope" "AuthorizationPolicyScope" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "builder_payload" JSONB NOT NULL,
    "cedar_source" TEXT NOT NULL,
    "sql_predicate" TEXT,
    "status" "AuthorizationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "authorization_policy_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_policy_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "draft_id" TEXT NOT NULL,
    "scope" "AuthorizationPolicyScope" NOT NULL,
    "version" INTEGER NOT NULL,
    "cedar_source" TEXT NOT NULL,
    "sql_predicate" TEXT,
    "content_hash" VARCHAR(64) NOT NULL,
    "published_at" BIGINT NOT NULL,
    "published_by_id" TEXT NOT NULL,
    "superseded_at" BIGINT,

    CONSTRAINT "authorization_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_policy_simulations" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "authorization_policy_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_grants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "support_user_id" TEXT NOT NULL,
    "target_membership_id" TEXT,
    "mode" "SupportAccessGrantMode" NOT NULL DEFAULT 'READ_ONLY',
    "status" "SupportAccessGrantStatus" NOT NULL DEFAULT 'PENDING_TENANT_APPROVAL',
    "reason" TEXT NOT NULL,
    "ticket_ref" VARCHAR(120),
    "tenant_approved_by_id" TEXT,
    "emergency_approved_by" VARCHAR(120),
    "expires_at" BIGINT NOT NULL,
    "revoked_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_encryption_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "wrapped_key" TEXT NOT NULL,
    "kms_key_id" VARCHAR(255) NOT NULL,
    "status" "TenantEncryptionKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "rotated_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "tenant_encryption_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "resource_type" VARCHAR(120) NOT NULL,
    "resource_id" VARCHAR(64),
    "decision" VARCHAR(32),
    "policy_version" INTEGER,
    "correlation_id" VARCHAR(64),
    "metadata" JSONB,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "visibility" "FileVisibility" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expected_checksum" VARCHAR(64) NOT NULL,
    "actual_checksum" VARCHAR(64),
    "storage_provider" "StorageProvider",
    "storage_container" VARCHAR(255),
    "object_revision" VARCHAR(64),
    "storage_bucket" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "public_path" VARCHAR(500),
    "object_generation" VARCHAR(64),
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "scan_status" "KybDocumentScanStatus",
    "scanned_at" BIGINT,
    "scan_result" VARCHAR(500),
    "uploaded_by_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_variants" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "kind" "FileVariantKind" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_provider" "StorageProvider",
    "storage_container" VARCHAR(255),
    "object_revision" VARCHAR(64),
    "storage_bucket" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "public_path" VARCHAR(500),
    "object_generation" VARCHAR(64),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "file_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "asset_type" "OrganizationAssetType" NOT NULL,
    "file_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_kyb_files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_kyb_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_kyb_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "storage_bucket" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "object_generation" VARCHAR(64),
    "scan_status" "KybDocumentScanStatus" NOT NULL DEFAULT 'SCANNING',
    "scanned_at" BIGINT,
    "scan_result" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_kyb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" VARCHAR(16) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "revoked_at" BIGINT,
    "last_used_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_terminals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "terminal_id" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "organization_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "reward_type" "RewardType" NOT NULL,
    "reward_value" INTEGER NOT NULL DEFAULT 0,
    "terms_conditions" TEXT,
    "reward_kind" "RewardKind" NOT NULL DEFAULT 'CONSUMER',
    "category" VARCHAR(100) NOT NULL,
    "placeholder_image_key" VARCHAR(100) NOT NULL,
    "rules" JSONB,
    "quantity_total" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "start_date" BIGINT,
    "expiry_date" BIGINT NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'DRAFT',
    "claim_count" INTEGER NOT NULL DEFAULT 0,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "referrals_enabled" BOOLEAN NOT NULL DEFAULT true,
    "referral_pool_total" INTEGER,
    "referral_pool_remaining" INTEGER,
    "referrer_reward_id" TEXT,
    "parent_consumer_reward_id" TEXT,
    "location_scope_type" "OrganizationLocationScopeType" NOT NULL DEFAULT 'ALL_LOCATIONS',
    "submitted_for_review_at" BIGINT,
    "auto_publish_at" BIGINT,
    "reviewed_at" BIGINT,
    "reviewed_by_user_id" TEXT,
    "rejection_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_location_scopes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_location_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "referral_id" TEXT,
    "redemption_token_hash" TEXT NOT NULL,
    "backup_code_hash" TEXT NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "is_referrer_credit" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" BIGINT NOT NULL,
    "claim_expires_at" BIGINT NOT NULL,
    "redeemed_at" BIGINT,
    "backup_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "backup_locked_until" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT,
    "user_id" TEXT NOT NULL,
    "terminal_id" VARCHAR(100) NOT NULL,
    "redemption_method" "RewardRedemptionMethod" NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "redeemed_at" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_referrals" (
    "id" TEXT NOT NULL,
    "referrer_user_id" TEXT NOT NULL,
    "referee_user_id" TEXT,
    "reward_id" TEXT NOT NULL,
    "attribution_token" VARCHAR(64) NOT NULL,
    "status" "RewardReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referee_device_hash" VARCHAR(128),
    "referee_ip" VARCHAR(45),
    "credited_at" BIGINT,
    "blocked_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "purpose" "RewardOtpPurpose" NOT NULL,
    "reward_id" TEXT,
    "code_hash" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_legal_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms_version" VARCHAR(32) NOT NULL,
    "privacy_version" VARCHAR(32) NOT NULL,
    "accepted_at" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "read_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "organization_id" TEXT,
    "action" VARCHAR(64) NOT NULL,
    "metadata" JSONB,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemption_idempotency_records" (
    "id" TEXT NOT NULL,
    "redemption_token_hash" TEXT NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "redemption_id" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "reward_redemption_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "partition_key" VARCHAR(255),
    "correlation_id" VARCHAR(64),
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "correlation_id" VARCHAR(64),
    "partition_key" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "occurred_at" BIGINT NOT NULL,
    "ingested_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_resource_audit_logs" (
    "id" TEXT NOT NULL,
    "resource_type" VARCHAR(120) NOT NULL,
    "resource_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "actor_user_id" UUID,
    "changes" JSONB,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "platform_resource_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_resource_idempotency_records" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "platform_resource_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_category" (
    "id" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "sample_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "brand" TEXT,
    "category_id" TEXT NOT NULL,
    "compare_at_price" DECIMAL(18,2),
    "description" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN,
    "is_featured" BOOLEAN,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "short_description" TEXT,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stock_quantity" INTEGER,
    "weight_grams" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_pending_attribution_token_idx" ON "users"("pending_attribution_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_parent_id_idx" ON "roles"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_resource_key" ON "permissions"("action", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "capability_definitions_slug_key" ON "capability_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "capability_definitions_permission_id_key" ON "capability_definitions"("permission_id");

-- CreateIndex
CREATE INDEX "capability_definitions_scope_idx" ON "capability_definitions"("scope");

-- CreateIndex
CREATE INDEX "permission_audit_logs_actor_id_idx" ON "permission_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_target_user_id_idx" ON "permission_audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_target_role_id_idx" ON "permission_audit_logs"("target_role_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_created_at_idx" ON "permission_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_digest_key" ON "password_reset_tokens"("token_digest");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_digest_idx" ON "password_reset_tokens"("token_digest");

-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "backup_codes_user_id_idx" ON "backup_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_pending_setups_user_id_key" ON "two_factor_pending_setups"("user_id");

-- CreateIndex
CREATE INDEX "two_factor_pending_setups_expires_at_idx" ON "two_factor_pending_setups"("expires_at");

-- CreateIndex
CREATE INDEX "two_factor_login_challenges_expires_at_idx" ON "two_factor_login_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "two_factor_login_challenges_user_id_idx" ON "two_factor_login_challenges"("user_id");

-- CreateIndex
CREATE INDEX "mfa_recovery_requests_user_id_idx" ON "mfa_recovery_requests"("user_id");

-- CreateIndex
CREATE INDEX "mfa_recovery_requests_status_idx" ON "mfa_recovery_requests"("status");

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
CREATE INDEX "subregions_region_id_idx" ON "subregions"("region_id");

-- CreateIndex
CREATE INDEX "countries_region_id_idx" ON "countries"("region_id");

-- CreateIndex
CREATE INDEX "countries_subregion_id_idx" ON "countries"("subregion_id");

-- CreateIndex
CREATE INDEX "states_country_id_idx" ON "states"("country_id");

-- CreateIndex
CREATE INDEX "cities_state_id_idx" ON "cities"("state_id");

-- CreateIndex
CREATE INDEX "cities_country_id_idx" ON "cities"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_lifecycle_state_idx" ON "organizations"("lifecycle_state");

-- CreateIndex
CREATE INDEX "organization_slug_history_organization_id_idx" ON "organization_slug_history"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_history_slug_key" ON "organization_slug_history"("slug");

-- CreateIndex
CREATE INDEX "organization_locations_organization_id_idx" ON "organization_locations"("organization_id");

-- CreateIndex
CREATE INDEX "organization_locations_organization_id_status_idx" ON "organization_locations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_locations_organization_id_code_key" ON "organization_locations"("organization_id", "code");

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships"("user_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_status_idx" ON "organization_memberships"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_key" ON "organization_memberships"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_membership_location_scopes_organization_id_idx" ON "organization_membership_location_scopes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_membership_location_scopes_membership_id_locat_key" ON "organization_membership_location_scopes"("membership_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_merchant_profiles_organization_id_key" ON "organization_merchant_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "organization_merchant_profiles_kyb_status_idx" ON "organization_merchant_profiles"("kyb_status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations"("organization_id");

-- CreateIndex
CREATE INDEX "organization_access_requests_organization_id_user_id_status_idx" ON "organization_access_requests"("organization_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "organization_access_requests_organization_id_status_idx" ON "organization_access_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_lifecycle_events_organization_id_created_at_idx" ON "organization_lifecycle_events"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_placements_organization_id_key" ON "tenant_placements"("organization_id");

-- CreateIndex
CREATE INDEX "organization_entitlements_organization_id_effective_from_idx" ON "organization_entitlements"("organization_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "organization_quotas_organization_id_quota_key_window_start_key" ON "organization_quotas"("organization_id", "quota_key", "window_start");

-- CreateIndex
CREATE INDEX "authorization_policy_drafts_organization_id_status_idx" ON "authorization_policy_drafts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "authorization_policy_versions_organization_id_published_at_idx" ON "authorization_policy_versions"("organization_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "authorization_policy_versions_organization_id_scope_version_key" ON "authorization_policy_versions"("organization_id", "scope", "version");

-- CreateIndex
CREATE INDEX "authorization_policy_simulations_draft_id_created_at_idx" ON "authorization_policy_simulations"("draft_id", "created_at");

-- CreateIndex
CREATE INDEX "support_access_grants_organization_id_status_idx" ON "support_access_grants"("organization_id", "status");

-- CreateIndex
CREATE INDEX "support_access_grants_support_user_id_status_idx" ON "support_access_grants"("support_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_encryption_keys_organization_id_key_version_key" ON "tenant_encryption_keys"("organization_id", "key_version");

-- CreateIndex
CREATE INDEX "organization_audit_logs_organization_id_created_at_idx" ON "organization_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "organization_audit_logs_organization_id_action_idx" ON "organization_audit_logs"("organization_id", "action");

-- CreateIndex
CREATE INDEX "stored_files_uploaded_by_id_idx" ON "stored_files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "stored_files_organization_id_idx" ON "stored_files"("organization_id");

-- CreateIndex
CREATE INDEX "stored_files_status_idx" ON "stored_files"("status");

-- CreateIndex
CREATE INDEX "stored_files_category_idx" ON "stored_files"("category");

-- CreateIndex
CREATE INDEX "file_variants_file_id_idx" ON "file_variants"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_variants_file_id_kind_key" ON "file_variants"("file_id", "kind");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_images_file_id_idx" ON "product_images"("file_id");

-- CreateIndex
CREATE INDEX "organization_assets_file_id_idx" ON "organization_assets"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_assets_organization_id_asset_type_key" ON "organization_assets"("organization_id", "asset_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_user_id_key" ON "user_avatars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_file_id_key" ON "user_avatars"("file_id");

-- CreateIndex
CREATE INDEX "organization_kyb_files_organization_id_idx" ON "organization_kyb_files"("organization_id");

-- CreateIndex
CREATE INDEX "organization_kyb_files_organization_id_is_active_idx" ON "organization_kyb_files"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "organization_kyb_files_submission_id_idx" ON "organization_kyb_files"("submission_id");

-- CreateIndex
CREATE INDEX "organization_kyb_files_file_id_idx" ON "organization_kyb_files"("file_id");

-- CreateIndex
CREATE INDEX "organization_kyb_documents_organization_id_idx" ON "organization_kyb_documents"("organization_id");

-- CreateIndex
CREATE INDEX "organization_kyb_documents_organization_id_is_active_idx" ON "organization_kyb_documents"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "organization_kyb_documents_submission_id_idx" ON "organization_kyb_documents"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_api_keys_key_hash_key" ON "organization_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "organization_api_keys_organization_id_idx" ON "organization_api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "organization_api_keys_location_id_idx" ON "organization_api_keys"("location_id");

-- CreateIndex
CREATE INDEX "organization_terminals_location_id_idx" ON "organization_terminals"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_terminals_organization_id_terminal_id_key" ON "organization_terminals"("organization_id", "terminal_id");

-- CreateIndex
CREATE INDEX "rewards_organization_id_idx" ON "rewards"("organization_id");

-- CreateIndex
CREATE INDEX "rewards_status_idx" ON "rewards"("status");

-- CreateIndex
CREATE INDEX "rewards_category_idx" ON "rewards"("category");

-- CreateIndex
CREATE INDEX "rewards_expiry_date_idx" ON "rewards"("expiry_date");

-- CreateIndex
CREATE INDEX "rewards_auto_publish_at_idx" ON "rewards"("auto_publish_at");

-- CreateIndex
CREATE INDEX "rewards_reward_kind_idx" ON "rewards"("reward_kind");

-- CreateIndex
CREATE INDEX "reward_location_scopes_organization_id_idx" ON "reward_location_scopes"("organization_id");

-- CreateIndex
CREATE INDEX "reward_location_scopes_location_id_idx" ON "reward_location_scopes"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_location_scopes_reward_id_location_id_key" ON "reward_location_scopes"("reward_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_redemption_token_hash_key" ON "reward_claims"("redemption_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "reward_claims_backup_code_hash_key" ON "reward_claims"("backup_code_hash");

-- CreateIndex
CREATE INDEX "reward_claims_user_id_idx" ON "reward_claims"("user_id");

-- CreateIndex
CREATE INDEX "reward_claims_reward_id_idx" ON "reward_claims"("reward_id");

-- CreateIndex
CREATE INDEX "reward_claims_status_idx" ON "reward_claims"("status");

-- CreateIndex
CREATE INDEX "reward_claims_claim_expires_at_idx" ON "reward_claims"("claim_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_claim_id_key" ON "reward_redemptions"("claim_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_organization_id_idx" ON "reward_redemptions"("organization_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_location_id_idx" ON "reward_redemptions"("location_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_redeemed_at_idx" ON "reward_redemptions"("redeemed_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_organization_id_idempotency_key_key" ON "reward_redemptions"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "reward_referrals_attribution_token_key" ON "reward_referrals"("attribution_token");

-- CreateIndex
CREATE INDEX "reward_referrals_referrer_user_id_idx" ON "reward_referrals"("referrer_user_id");

-- CreateIndex
CREATE INDEX "reward_referrals_referee_user_id_idx" ON "reward_referrals"("referee_user_id");

-- CreateIndex
CREATE INDEX "reward_referrals_reward_id_idx" ON "reward_referrals"("reward_id");

-- CreateIndex
CREATE INDEX "reward_referrals_status_idx" ON "reward_referrals"("status");

-- CreateIndex
CREATE INDEX "reward_otp_challenges_user_id_idx" ON "reward_otp_challenges"("user_id");

-- CreateIndex
CREATE INDEX "reward_otp_challenges_phone_idx" ON "reward_otp_challenges"("phone");

-- CreateIndex
CREATE INDEX "reward_otp_challenges_expires_at_idx" ON "reward_otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "reward_legal_acceptances_user_id_idx" ON "reward_legal_acceptances"("user_id");

-- CreateIndex
CREATE INDEX "reward_notifications_user_id_idx" ON "reward_notifications"("user_id");

-- CreateIndex
CREATE INDEX "reward_notifications_user_id_read_at_idx" ON "reward_notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "reward_notifications_created_at_idx" ON "reward_notifications"("created_at");

-- CreateIndex
CREATE INDEX "reward_audit_logs_organization_id_idx" ON "reward_audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "reward_audit_logs_action_idx" ON "reward_audit_logs"("action");

-- CreateIndex
CREATE INDEX "reward_audit_logs_created_at_idx" ON "reward_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "reward_redemption_idempotency_records_redemption_token_hash_idx" ON "reward_redemption_idempotency_records"("redemption_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemption_idempotency_records_redemption_token_hash_key" ON "reward_redemption_idempotency_records"("redemption_token_hash", "idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_topic_occurred_at_idx" ON "analytics_events"("topic", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_occurred_at_idx" ON "analytics_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_resource_audit_logs_resource_type_resource_id_crea_idx" ON "platform_resource_audit_logs"("resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_resource_idempotency_scope_key" ON "platform_resource_idempotency_records"("scope", "idempotency_key");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_definitions" ADD CONSTRAINT "capability_definitions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_pending_setups" ADD CONSTRAINT "two_factor_pending_setups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_login_challenges" ADD CONSTRAINT "two_factor_login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_recovery_requests" ADD CONSTRAINT "mfa_recovery_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "subregions" ADD CONSTRAINT "subregions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_subregion_id_fkey" FOREIGN KEY ("subregion_id") REFERENCES "subregions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_slug_history" ADD CONSTRAINT "organization_slug_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership_location_scopes" ADD CONSTRAINT "organization_membership_location_scopes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership_location_scopes" ADD CONSTRAINT "organization_membership_location_scopes_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership_location_scopes" ADD CONSTRAINT "organization_membership_location_scopes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_merchant_profiles" ADD CONSTRAINT "organization_merchant_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_lifecycle_events" ADD CONSTRAINT "organization_lifecycle_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_quotas" ADD CONSTRAINT "organization_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_drafts" ADD CONSTRAINT "authorization_policy_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_drafts" ADD CONSTRAINT "authorization_policy_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_drafts" ADD CONSTRAINT "authorization_policy_drafts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_versions" ADD CONSTRAINT "authorization_policy_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_versions" ADD CONSTRAINT "authorization_policy_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "authorization_policy_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_versions" ADD CONSTRAINT "authorization_policy_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_simulations" ADD CONSTRAINT "authorization_policy_simulations_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "authorization_policy_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_policy_simulations" ADD CONSTRAINT "authorization_policy_simulations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_support_user_id_fkey" FOREIGN KEY ("support_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_encryption_keys" ADD CONSTRAINT "tenant_encryption_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_audit_logs" ADD CONSTRAINT "organization_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_variants" ADD CONSTRAINT "file_variants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_assets" ADD CONSTRAINT "organization_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_assets" ADD CONSTRAINT "organization_assets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_kyb_files" ADD CONSTRAINT "organization_kyb_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_kyb_files" ADD CONSTRAINT "organization_kyb_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_kyb_documents" ADD CONSTRAINT "organization_kyb_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_terminals" ADD CONSTRAINT "organization_terminals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_terminals" ADD CONSTRAINT "organization_terminals_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_referrer_reward_id_fkey" FOREIGN KEY ("referrer_reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_parent_consumer_reward_id_fkey" FOREIGN KEY ("parent_consumer_reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_location_scopes" ADD CONSTRAINT "reward_location_scopes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_location_scopes" ADD CONSTRAINT "reward_location_scopes_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_location_scopes" ADD CONSTRAINT "reward_location_scopes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "reward_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "reward_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_referrals" ADD CONSTRAINT "reward_referrals_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_referrals" ADD CONSTRAINT "reward_referrals_referee_user_id_fkey" FOREIGN KEY ("referee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_referrals" ADD CONSTRAINT "reward_referrals_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_otp_challenges" ADD CONSTRAINT "reward_otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_legal_acceptances" ADD CONSTRAINT "reward_legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_notifications" ADD CONSTRAINT "reward_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_audit_logs" ADD CONSTRAINT "reward_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_audit_logs" ADD CONSTRAINT "reward_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "sample_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
