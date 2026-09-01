-- AlterTable
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "cities" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "clicks" ALTER COLUMN "clicked_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "countries" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

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
ALTER TABLE "merchant_api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_invites" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_members" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_orgs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_terminals" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
ALTER TABLE "regions" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "reward_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_claims" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_legal_acceptances" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_notifications" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_otp_challenges" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_redemption_idempotency_records" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_redemptions" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "reward_referrals" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "rewards" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "assignedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "states" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "subregions" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
