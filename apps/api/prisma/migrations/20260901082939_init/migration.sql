-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "RedirectType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST', 'MANAGE');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('USER', 'PROFILE', 'ROLE', 'PERMISSION', 'ADMIN_DASHBOARD', 'SYSTEM_SETTINGS', 'URL', 'TAG', 'API_KEY', 'ANALYTICS', 'AUDIT_LOG', 'REPORT', 'EMAIL', 'GEO', 'REWARD', 'MERCHANT_ORG', 'REDEMPTION');

-- CreateEnum
CREATE TYPE "MenuMatchType" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "PilotCity" AS ENUM ('KUALA_LUMPUR', 'MELAKA');

-- CreateEnum
CREATE TYPE "MerchantOrgStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MerchantMemberRole" AS ENUM ('OWNER', 'CASHIER');

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
CREATE TABLE "merchant_orgs" (
    "id" TEXT NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(200),
    "category" VARCHAR(100) NOT NULL,
    "address_text" TEXT,
    "city" "PilotCity" NOT NULL,
    "kyb_status" "KybStatus" NOT NULL DEFAULT 'PENDING',
    "kyb_fields" JSONB,
    "status" "MerchantOrgStatus" NOT NULL DEFAULT 'ONBOARDING',
    "contact_email" VARCHAR(100) NOT NULL,
    "contact_phone" VARCHAR(20),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "merchant_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_org_id" TEXT NOT NULL,
    "role" "MerchantMemberRole" NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "merchant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_api_keys" (
    "id" TEXT NOT NULL,
    "merchant_org_id" TEXT NOT NULL,
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

    CONSTRAINT "merchant_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_terminals" (
    "id" TEXT NOT NULL,
    "merchant_org_id" TEXT NOT NULL,
    "terminal_id" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "merchant_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_invites" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "city" "PilotCity" NOT NULL,
    "merchant_org_id" TEXT,
    "created_by_admin_id" TEXT NOT NULL,
    "accepted_by_user_id" TEXT,
    "expires_at" BIGINT NOT NULL,
    "accepted_at" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
    "updated_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,

    CONSTRAINT "merchant_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "merchant_org_id" TEXT NOT NULL,
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
    "merchant_org_id" TEXT NOT NULL,
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
    "merchant_org_id" TEXT,
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
CREATE INDEX "merchant_orgs_city_idx" ON "merchant_orgs"("city");

-- CreateIndex
CREATE INDEX "merchant_orgs_status_idx" ON "merchant_orgs"("status");

-- CreateIndex
CREATE INDEX "merchant_orgs_kyb_status_idx" ON "merchant_orgs"("kyb_status");

-- CreateIndex
CREATE INDEX "merchant_members_merchant_org_id_idx" ON "merchant_members"("merchant_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_members_user_id_merchant_org_id_key" ON "merchant_members"("user_id", "merchant_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_api_keys_key_hash_key" ON "merchant_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "merchant_api_keys_merchant_org_id_idx" ON "merchant_api_keys"("merchant_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_terminals_merchant_org_id_terminal_id_key" ON "merchant_terminals"("merchant_org_id", "terminal_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_invites_token_hash_key" ON "merchant_invites"("token_hash");

-- CreateIndex
CREATE INDEX "merchant_invites_email_idx" ON "merchant_invites"("email");

-- CreateIndex
CREATE INDEX "merchant_invites_expires_at_idx" ON "merchant_invites"("expires_at");

-- CreateIndex
CREATE INDEX "rewards_merchant_org_id_idx" ON "rewards"("merchant_org_id");

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
CREATE INDEX "reward_redemptions_merchant_org_id_idx" ON "reward_redemptions"("merchant_org_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_redeemed_at_idx" ON "reward_redemptions"("redeemed_at");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_merchant_org_id_idempotency_key_key" ON "reward_redemptions"("merchant_org_id", "idempotency_key");

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
CREATE INDEX "reward_audit_logs_merchant_org_id_idx" ON "reward_audit_logs"("merchant_org_id");

-- CreateIndex
CREATE INDEX "reward_audit_logs_action_idx" ON "reward_audit_logs"("action");

-- CreateIndex
CREATE INDEX "reward_audit_logs_created_at_idx" ON "reward_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "reward_redemption_idempotency_records_redemption_token_hash_idx" ON "reward_redemption_idempotency_records"("redemption_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemption_idempotency_records_redemption_token_hash_key" ON "reward_redemption_idempotency_records"("redemption_token_hash", "idempotency_key");

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
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_terminals" ADD CONSTRAINT "merchant_terminals_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_referrer_reward_id_fkey" FOREIGN KEY ("referrer_reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_parent_consumer_reward_id_fkey" FOREIGN KEY ("parent_consumer_reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "reward_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "reward_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "reward_audit_logs" ADD CONSTRAINT "reward_audit_logs_merchant_org_id_fkey" FOREIGN KEY ("merchant_org_id") REFERENCES "merchant_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
