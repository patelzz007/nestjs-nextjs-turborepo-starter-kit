-- AlterTable
ALTER TABLE "analytics_events" ALTER COLUMN "ingested_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "authorization_policy_drafts" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "authorization_policy_simulations" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "backup_codes" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "capability_definitions" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
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
ALTER TABLE "file_variants" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "impersonation_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "logs" ALTER COLUMN "timestamp" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_api_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_assets" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_invites" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_kyb_documents" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_kyb_files" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_members" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_orgs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_role_capabilities" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "merchant_terminals" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "mfa_recovery_requests" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_access_requests" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_entitlements" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_invitations" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_lifecycle_events" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_locations" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_membership_location_scopes" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_memberships" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_merchant_profiles" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_quotas" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organization_slug_history" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "password_history" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
ALTER TABLE "platform_resource_audit_logs" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "platform_resource_idempotency_records" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "product" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "product_images" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

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
ALTER TABLE "sample_category" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "states" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "stored_files" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "subregions" ALTER COLUMN "created_at" SET DEFAULT '2014-01-01 12:01:01';

-- AlterTable
ALTER TABLE "support_access_grants" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "tenant_encryption_keys" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "tenant_placements" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "two_factor_login_challenges" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "two_factor_pending_setups" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "url_tags" ALTER COLUMN "createdAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updatedAt" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "urls" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
ALTER COLUMN "updated_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

-- AlterTable
ALTER TABLE "user_avatars" ALTER COLUMN "created_at" SET DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
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
