-- ============================================================================
-- Row-Level Security — main bundle (idempotent)
-- ============================================================================
-- Prisma migrations do NOT emit RLS. Do not append this SQL to migration.sql
-- (squashed migrations would drop it). Security is applied automatically by:
--
--   pnpm db:migrate | db:deploy | db:reset | db:push
--
-- via `prisma/rls/apply.ts` — apply order + fresh-database validation live in
-- `RLS_APPLY_ORDER` (prisma/rls/apply-plan.ts).
-- See prisma/rls/README.md and docs/technical/security/database-security.md.
-- ============================================================================

-- ── 1. app_runtime role ────────────────────────────────────────────────────
-- Created (and granted to the migrating user) in prisma/rls/00-app-helpers.sql,
-- which is applied first — see RLS_APPLY_ORDER.

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- ── 2. EXECUTE grants for base helpers ─────────────────────────────────────
-- Definitions live in `prisma/rls/00-app-helpers.sql` (applied first —
-- `01-acl-location-access.sql` calls them, so they must predate this bundle).
-- Only the grants happen here, after the role from §1 exists. EXECUTE on every
-- helper (including `01`'s) is re-applied by `99-app-runtime-grants.sql`.

GRANT EXECUTE ON FUNCTION app_rls_bypass() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_rls_bypass_on(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_owns(text) TO app_runtime;

-- ── 3. Enable RLS on every table ───────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User',
    'Role',
    'Permission',
    'CapabilityDefinition',
    'PermissionAuditLog',
    'PasswordResetToken',
    'PasswordHistory',
    'BackupCode',
    'TwoFactorPendingSetup',
    'TwoFactorLoginChallenge',
    'MfaRecoveryRequest',
    'GithubAccountLink',
    'UserRole',
    'UserPermission',
    'RolePermission',
    'RefreshToken',
    'ImpersonationAuditLog',
    'EmailLog',
    'EmailDeliveryEvent',
    'OutboxEvent',
    'AnalyticsEvent',
    'InboxProcessedEvent',
    'InboxDeadLetter',
    'AuditLog',
    'DataChangeLog',
    'PlatformResourceIdempotencyRecord',
    'GithubWebhookSubscription',
    'GithubWebhookDelivery'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 4. Policies ────────────────────────────────────────────────────────────

-- ── Ownership policies (user-scoped tables) ────────────────────────────────

DROP POLICY IF EXISTS users_own ON public."User";
CREATE POLICY users_own ON public."User"
  USING ((SELECT app_rls_bypass_on('User')) OR (app_owns(id)))
  WITH CHECK ((SELECT app_rls_bypass_on('User')) OR (app_owns(id)));

DROP POLICY IF EXISTS refresh_tokens_own ON public."RefreshToken";
CREATE POLICY refresh_tokens_own ON public."RefreshToken"
  USING ((SELECT app_rls_bypass_on('RefreshToken')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('RefreshToken')) OR (app_owns("userId")));

DROP POLICY IF EXISTS password_reset_tokens_own ON public."PasswordResetToken";
CREATE POLICY password_reset_tokens_own ON public."PasswordResetToken"
  USING ((SELECT app_rls_bypass_on('PasswordResetToken')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('PasswordResetToken')) OR (app_owns("userId")));

DROP POLICY IF EXISTS password_history_own ON public."PasswordHistory";
CREATE POLICY password_history_own ON public."PasswordHistory"
  USING ((SELECT app_rls_bypass_on('PasswordHistory')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('PasswordHistory')) OR (app_owns("userId")));

DROP POLICY IF EXISTS backup_codes_own ON public."BackupCode";
CREATE POLICY backup_codes_own ON public."BackupCode"
  USING ((SELECT app_rls_bypass_on('BackupCode')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('BackupCode')) OR (app_owns("userId")));

DROP POLICY IF EXISTS two_factor_pending_setups_own ON public."TwoFactorPendingSetup";
CREATE POLICY two_factor_pending_setups_own ON public."TwoFactorPendingSetup"
  USING ((SELECT app_rls_bypass_on('TwoFactorPendingSetup')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('TwoFactorPendingSetup')) OR (app_owns("userId")));

-- An admin's own GitHub token (ADR 052): only its owner's session reads or writes it.
DROP POLICY IF EXISTS github_account_links_own ON public."GithubAccountLink";
CREATE POLICY github_account_links_own ON public."GithubAccountLink"
  USING ((SELECT app_rls_bypass_on('GithubAccountLink')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('GithubAccountLink')) OR (app_owns("userId")));

DROP POLICY IF EXISTS two_factor_login_challenges_own ON public."TwoFactorLoginChallenge";
CREATE POLICY two_factor_login_challenges_own ON public."TwoFactorLoginChallenge"
  USING ((SELECT app_rls_bypass_on('TwoFactorLoginChallenge')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('TwoFactorLoginChallenge')) OR (app_owns("userId")));

DROP POLICY IF EXISTS mfa_recovery_requests_own ON public."MfaRecoveryRequest";
CREATE POLICY mfa_recovery_requests_own ON public."MfaRecoveryRequest"
  USING ((SELECT app_rls_bypass_on('MfaRecoveryRequest')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('MfaRecoveryRequest')) OR (app_owns("userId")));

DROP POLICY IF EXISTS user_roles_own ON public."UserRole";
CREATE POLICY user_roles_own ON public."UserRole"
  USING ((SELECT app_rls_bypass_on('UserRole')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('UserRole')) OR (app_owns("userId")));

DROP POLICY IF EXISTS user_permissions_own ON public."UserPermission";
CREATE POLICY user_permissions_own ON public."UserPermission"
  USING ((SELECT app_rls_bypass_on('UserPermission')) OR (app_owns("userId")))
  WITH CHECK ((SELECT app_rls_bypass_on('UserPermission')) OR (app_owns("userId")));

-- ── Shared / RBAC tables (world-readable, bypass-only writes) ──────────────

DROP POLICY IF EXISTS roles_read ON public."Role";
CREATE POLICY roles_read ON public."Role"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS roles_write ON public."Role";
CREATE POLICY roles_write ON public."Role"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Role')))
  WITH CHECK ((SELECT app_rls_bypass_on('Role')));

DROP POLICY IF EXISTS permissions_read ON public."Permission";
CREATE POLICY permissions_read ON public."Permission"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS permissions_write ON public."Permission";
CREATE POLICY permissions_write ON public."Permission"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Permission')))
  WITH CHECK ((SELECT app_rls_bypass_on('Permission')));

DROP POLICY IF EXISTS capability_definitions_read ON public."CapabilityDefinition";
CREATE POLICY capability_definitions_read ON public."CapabilityDefinition"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS capability_definitions_write ON public."CapabilityDefinition";
CREATE POLICY capability_definitions_write ON public."CapabilityDefinition"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('CapabilityDefinition')))
  WITH CHECK ((SELECT app_rls_bypass_on('CapabilityDefinition')));

DROP POLICY IF EXISTS role_permissions_read ON public."RolePermission";
CREATE POLICY role_permissions_read ON public."RolePermission"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS role_permissions_write ON public."RolePermission";
CREATE POLICY role_permissions_write ON public."RolePermission"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('RolePermission')))
  WITH CHECK ((SELECT app_rls_bypass_on('RolePermission')));

-- ── Authorization kernel (ACL, policies, audit) ────────────────────────────

ALTER TABLE public."ResourceAcl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ResourceAcl" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_acls_member ON public."ResourceAcl";
CREATE POLICY resource_acls_member ON public."ResourceAcl"
  USING (
    (SELECT app_rls_bypass_on('ResourceAcl'))
    OR "tenantId" IS NULL
    OR app_tenant_member_of("tenantId")
  )
  WITH CHECK ((SELECT app_rls_bypass_on('ResourceAcl')));

ALTER TABLE public."PolicyDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PolicyDefinition" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_definitions_read ON public."PolicyDefinition";
CREATE POLICY policy_definitions_read ON public."PolicyDefinition"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('PolicyDefinition'))
    OR "tenantId" IS NULL
    OR app_tenant_member_of("tenantId")
  );

DROP POLICY IF EXISTS policy_definitions_write ON public."PolicyDefinition";
CREATE POLICY policy_definitions_write ON public."PolicyDefinition"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('PolicyDefinition')))
  WITH CHECK ((SELECT app_rls_bypass_on('PolicyDefinition')));

ALTER TABLE public."AuthorizationAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthorizationAudit" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_audits_bypass ON public."AuthorizationAudit";
CREATE POLICY authorization_audits_bypass ON public."AuthorizationAudit"
  USING ((SELECT app_rls_bypass_on('AuthorizationAudit')))
  WITH CHECK ((SELECT app_rls_bypass_on('AuthorizationAudit')));

-- ── Append-mostly tables (insert public, select/update/delete via bypass) ──

DROP POLICY IF EXISTS email_logs_bypass ON public."EmailLog";
DROP POLICY IF EXISTS email_logs_insert ON public."EmailLog";
DROP POLICY IF EXISTS email_logs_select ON public."EmailLog";
DROP POLICY IF EXISTS email_logs_update ON public."EmailLog";
DROP POLICY IF EXISTS email_logs_delete ON public."EmailLog";
CREATE POLICY email_logs_insert ON public."EmailLog" FOR INSERT WITH CHECK (true);
CREATE POLICY email_logs_select ON public."EmailLog" FOR SELECT USING ((SELECT app_rls_bypass_on('EmailLog')));
CREATE POLICY email_logs_update ON public."EmailLog" FOR UPDATE USING ((SELECT app_rls_bypass_on('EmailLog'))) WITH CHECK ((SELECT app_rls_bypass_on('EmailLog')));
CREATE POLICY email_logs_delete ON public."EmailLog" FOR DELETE USING ((SELECT app_rls_bypass_on('EmailLog')));

-- GitHub live updates (ADR 052): platform plumbing, reached only through the allowlisted system
-- operations `github.webhook.subscriptions` (after the caller's GITHUB_PULL_REQUEST check) and
-- `github.webhook.deliveries` (after a delivery's signature is verified).
DROP POLICY IF EXISTS github_webhook_subscriptions_bypass ON public."GithubWebhookSubscription";
CREATE POLICY github_webhook_subscriptions_bypass ON public."GithubWebhookSubscription"
  USING ((SELECT app_rls_bypass_on('GithubWebhookSubscription')))
  WITH CHECK ((SELECT app_rls_bypass_on('GithubWebhookSubscription')));

DROP POLICY IF EXISTS github_webhook_deliveries_bypass ON public."GithubWebhookDelivery";
CREATE POLICY github_webhook_deliveries_bypass ON public."GithubWebhookDelivery"
  USING ((SELECT app_rls_bypass_on('GithubWebhookDelivery')))
  WITH CHECK ((SELECT app_rls_bypass_on('GithubWebhookDelivery')));

-- Resend delivery-webhook history (one row per verified webhook delivery). Written
-- and read only by the signature-verified webhook route — bypass-only.
DROP POLICY IF EXISTS email_delivery_events_bypass ON public."EmailDeliveryEvent";
CREATE POLICY email_delivery_events_bypass ON public."EmailDeliveryEvent"
  USING ((SELECT app_rls_bypass_on('EmailDeliveryEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('EmailDeliveryEvent')));

-- ── Audit tables (bypass-only) ─────────────────────────────────────────────

DROP POLICY IF EXISTS permission_audit_logs_bypass ON public."PermissionAuditLog";
CREATE POLICY permission_audit_logs_bypass ON public."PermissionAuditLog"
  USING ((SELECT app_rls_bypass_on('PermissionAuditLog')))
  WITH CHECK ((SELECT app_rls_bypass_on('PermissionAuditLog')));

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public."ImpersonationAuditLog";
CREATE POLICY impersonation_audit_logs_bypass ON public."ImpersonationAuditLog"
  USING ((SELECT app_rls_bypass_on('ImpersonationAuditLog')))
  WITH CHECK ((SELECT app_rls_bypass_on('ImpersonationAuditLog')));

-- Impersonation audit is append-only for app_runtime: UPDATE/DELETE are withheld
-- via prisma/rls/withheld-privileges.ts (revoked after the blanket grant in 99).

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public."ImpersonationAuditLog";

DROP POLICY IF EXISTS impersonation_audit_logs_select ON public."ImpersonationAuditLog";
CREATE POLICY impersonation_audit_logs_select ON public."ImpersonationAuditLog"
  FOR SELECT
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('ImpersonationAuditLog')));

DROP POLICY IF EXISTS impersonation_audit_logs_insert ON public."ImpersonationAuditLog";
CREATE POLICY impersonation_audit_logs_insert ON public."ImpersonationAuditLog"
  FOR INSERT
  TO app_runtime
  WITH CHECK ((SELECT app_rls_bypass_on('ImpersonationAuditLog')));

-- Impersonation sessions: written under `platform.superadmin` or `auth.impersonation.start`,
-- read by AuthGuard under `auth.principal.lookup`.
-- Rows are never deleted (ended sessions are part of the forensic record).
ALTER TABLE public."ImpersonationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImpersonationSession" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impersonation_sessions_bypass ON public."ImpersonationSession";
CREATE POLICY impersonation_sessions_bypass ON public."ImpersonationSession"
  USING ((SELECT app_rls_bypass_on('ImpersonationSession')))
  WITH CHECK ((SELECT app_rls_bypass_on('ImpersonationSession')));
-- DELETE is withheld from app_runtime via prisma/rls/withheld-privileges.ts.

-- MFA recovery audit: append-only domain audit, written only inside the
-- `auth.mfa_recovery.*` / `maintenance.mfa_recovery_unlock` system operations.
ALTER TABLE public."MfaRecoveryAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MfaRecoveryAuditLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfa_recovery_audit_logs_select ON public."MfaRecoveryAuditLog";
CREATE POLICY mfa_recovery_audit_logs_select ON public."MfaRecoveryAuditLog"
  FOR SELECT
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('MfaRecoveryAuditLog')));

DROP POLICY IF EXISTS mfa_recovery_audit_logs_insert ON public."MfaRecoveryAuditLog";
CREATE POLICY mfa_recovery_audit_logs_insert ON public."MfaRecoveryAuditLog"
  FOR INSERT
  TO app_runtime
  WITH CHECK ((SELECT app_rls_bypass_on('MfaRecoveryAuditLog')));
-- UPDATE/DELETE are withheld from app_runtime via prisma/rls/withheld-privileges.ts.

-- ── Geo tables (reference data: public read, SuperAdmin write) ───────────
-- Writes are allowed ONLY under the `geo.reference_data.write` system
-- operation (GeoRepository, SuperAdmin-only endpoints) or the CLI-only
-- `seed.demo_dataset` (pnpm db:seed loads the geo dataset) — not under any
-- other bypass. Rows are soft-deleted: DELETE is revoked from app_runtime in
-- 99-app-runtime-grants.sql.

ALTER TABLE IF EXISTS public."Region" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Region" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regions_read ON public."Region";
CREATE POLICY regions_read ON public."Region"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS regions_write ON public."Region";
CREATE POLICY regions_write ON public."Region"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Region')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'))
  WITH CHECK ((SELECT app_rls_bypass_on('Region')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'));

ALTER TABLE IF EXISTS public."Subregion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Subregion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subregions_read ON public."Subregion";
CREATE POLICY subregions_read ON public."Subregion"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS subregions_write ON public."Subregion";
CREATE POLICY subregions_write ON public."Subregion"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Subregion')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'))
  WITH CHECK ((SELECT app_rls_bypass_on('Subregion')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'));

ALTER TABLE IF EXISTS public."Country" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Country" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS countries_read ON public."Country";
CREATE POLICY countries_read ON public."Country"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS countries_write ON public."Country";
CREATE POLICY countries_write ON public."Country"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Country')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'))
  WITH CHECK ((SELECT app_rls_bypass_on('Country')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'));

ALTER TABLE IF EXISTS public."State" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."State" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS states_read ON public."State";
CREATE POLICY states_read ON public."State"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS states_write ON public."State";
CREATE POLICY states_write ON public."State"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('State')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'))
  WITH CHECK ((SELECT app_rls_bypass_on('State')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'));

ALTER TABLE IF EXISTS public."City" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."City" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cities_read ON public."City";
CREATE POLICY cities_read ON public."City"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS cities_write ON public."City";
CREATE POLICY cities_write ON public."City"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('City')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'))
  WITH CHECK ((SELECT app_rls_bypass_on('City')) AND app_system_operation() IN ('geo.reference_data.write', 'seed.demo_dataset'));

-- ── Rewards platform (tenant-scoped — ReBAC via app_tenant_org_member in 01) ─

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'TenantApiKey',
    'TenantTerminal',
    'Reward',
    'RewardClaim',
    'RewardRedemption',
    'RewardSale',
    'RewardReferral',
    'SignupReferralCode',
    'SignupReferral',
    'RewardOtpChallenge',
    'RewardLegalAcceptance',
    'RewardNotification',
    'RewardAuditLog',
    'StoredFile',
    'FileVariant',
    'ProductImage',
    'TenantAsset',
    'UserAvatar',
    'UserPreference',
    'TenantKybFile'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS stored_files_owner ON public."StoredFile";
CREATE POLICY stored_files_owner ON public."StoredFile"
  USING (app_owns("uploadedById") OR ("tenantId" IS NOT NULL AND app_tenant_org_member("tenantId")) OR (SELECT app_rls_bypass_on('StoredFile')))
  WITH CHECK (app_owns("uploadedById") OR ("tenantId" IS NOT NULL AND app_tenant_org_member("tenantId")) OR (SELECT app_rls_bypass_on('StoredFile')));

-- A reward's images are readable by whoever can read the reward (marketplace
-- shoppers, claim holders, members): the EXISTS runs under rewards_read (through
-- reward_images_read), so image visibility follows reward visibility exactly.
-- Read-only, and only for public REWARD_IMAGE files — every other file stays
-- owner/member-scoped.
DROP POLICY IF EXISTS stored_files_reward_cover_read ON public."StoredFile";
DROP POLICY IF EXISTS stored_files_reward_image_read ON public."StoredFile";
CREATE POLICY stored_files_reward_image_read ON public."StoredFile"
  FOR SELECT
  USING (
    category = 'REWARD_IMAGE'
    AND visibility = 'PUBLIC'
    AND EXISTS (SELECT 1 FROM public."RewardImage" ri WHERE ri."fileId" = "StoredFile".id AND ri."isDeleted" = false)
  );

-- A public reward image's renditions are readable whenever the image itself is
-- (the EXISTS runs under stored_files RLS, so it follows stored_files_reward_image_read).
DROP POLICY IF EXISTS file_variants_reward_image_read ON public."FileVariant";
CREATE POLICY file_variants_reward_image_read ON public."FileVariant"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public."StoredFile" sf
      WHERE sf.id = "FileVariant"."fileId" AND sf.category = 'REWARD_IMAGE' AND sf.visibility = 'PUBLIC'
    )
  );

DROP POLICY IF EXISTS file_variants_file ON public."FileVariant";
CREATE POLICY file_variants_file ON public."FileVariant"
  USING (
    (SELECT app_rls_bypass_on('FileVariant'))
    OR EXISTS (
      SELECT 1 FROM public."StoredFile" sf
      WHERE sf.id = "fileId"
        AND (app_owns(sf."uploadedById") OR (sf."tenantId" IS NOT NULL AND app_tenant_org_member(sf."tenantId")))
    )
  )
  WITH CHECK (
    (SELECT app_rls_bypass_on('FileVariant'))
    OR EXISTS (
      SELECT 1 FROM public."StoredFile" sf
      WHERE sf.id = "fileId"
        AND (app_owns(sf."uploadedById") OR (sf."tenantId" IS NOT NULL AND app_tenant_org_member(sf."tenantId")))
    )
  );

DROP POLICY IF EXISTS product_images_catalog ON public."ProductImage";
CREATE POLICY product_images_catalog ON public."ProductImage"
  USING ((SELECT app_rls_bypass_on('ProductImage')))
  WITH CHECK ((SELECT app_rls_bypass_on('ProductImage')));

DROP POLICY IF EXISTS tenant_assets_org ON public."TenantAsset";
CREATE POLICY tenant_assets_org ON public."TenantAsset"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantAsset')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantAsset')));

DROP POLICY IF EXISTS user_avatars_owner ON public."UserAvatar";
CREATE POLICY user_avatars_owner ON public."UserAvatar"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserAvatar')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserAvatar')));

-- A person's remembered choices (board grouping, …): their own rows only.
DROP POLICY IF EXISTS user_preferences_owner ON public."UserPreference";
CREATE POLICY user_preferences_owner ON public."UserPreference"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPreference')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPreference')));

DROP POLICY IF EXISTS tenant_kyb_files_org ON public."TenantKybFile";
CREATE POLICY tenant_kyb_files_org ON public."TenantKybFile"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantKybFile')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantKybFile')));

-- The session's user holds a (non-deleted) claim on the reward. A claim is the
-- user's own record, so the reward it names stays readable to them after the
-- reward stops being public (expired, disabled, archived, soft-deleted) — the
-- wallet and claim history must still show what was claimed. SECURITY DEFINER
-- so it reads reward_claims without re-entering that table's policies, one of
-- which (reward_claims_merchant_read) reads rewards — a policy cycle Postgres
-- rejects. Fail-closed: no user in the session, no access.
CREATE OR REPLACE FUNCTION app_holds_reward_claim("rewardId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardClaim" c
      WHERE c."rewardId" = app_holds_reward_claim."rewardId"
        AND c."userId" = app_current_user_id()
        AND c."isDeleted" = false
    );
$$;

GRANT EXECUTE ON FUNCTION app_holds_reward_claim(text) TO app_runtime;

-- Published consumer rewards are marketplace-readable; tenant members see all org
-- rewards; a claim holder sees the reward they claimed, whatever its state now.
DROP POLICY IF EXISTS rewards_read ON public."Reward";
CREATE POLICY rewards_read ON public."Reward"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('Reward'))
    OR app_tenant_org_member("tenantId")
    OR (
      "isDeleted" = false
      AND "rewardKind" = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
    OR app_holds_reward_claim(id)
  );

DROP POLICY IF EXISTS rewards_write ON public."Reward";
CREATE POLICY rewards_write ON public."Reward"
  FOR INSERT
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('Reward')));

DROP POLICY IF EXISTS rewards_update ON public."Reward";
CREATE POLICY rewards_update ON public."Reward"
  FOR UPDATE
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('Reward')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('Reward')));

DROP POLICY IF EXISTS rewards_delete ON public."Reward";
CREATE POLICY rewards_delete ON public."Reward"
  FOR DELETE
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('Reward')));

ALTER TABLE public."RewardLocationScope" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RewardLocationScope" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_location_scopes_read ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_read ON public."RewardLocationScope"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('RewardLocationScope'))
    OR app_tenant_org_member("tenantId")
    OR EXISTS (
      SELECT 1 FROM public."Reward" r
      WHERE r.id = "RewardLocationScope"."rewardId"
        AND r."isDeleted" = false
        AND r."rewardKind" = 'CONSUMER'
        AND r.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS reward_location_scopes_write ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_write ON public."RewardLocationScope"
  FOR ALL
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardLocationScope')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardLocationScope')));

ALTER TABLE public."RewardImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RewardImage" FORCE ROW LEVEL SECURITY;

-- An image row is visible exactly when its reward is (the EXISTS runs under rewards_read).
DROP POLICY IF EXISTS reward_images_read ON public."RewardImage";
CREATE POLICY reward_images_read ON public."RewardImage"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('RewardImage'))
    OR app_tenant_org_member("tenantId")
    OR EXISTS (SELECT 1 FROM public."Reward" r WHERE r.id = "RewardImage"."rewardId")
  );

DROP POLICY IF EXISTS reward_images_write ON public."RewardImage";
CREATE POLICY reward_images_write ON public."RewardImage"
  FOR ALL
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardImage')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardImage')));

DROP POLICY IF EXISTS reward_claims_own ON public."RewardClaim";
CREATE POLICY reward_claims_own ON public."RewardClaim"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaim')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaim')));

-- The merchant's members may READ the claims of their tenant's rewards
-- (redemption history and analytics join a redemption to its claim and reward).
-- Read-only: claims are written by the customer (own row) or system flows.
-- Location scope within the tenant is enforced by the API service layer.
DROP POLICY IF EXISTS reward_claims_merchant_read ON public."RewardClaim";
CREATE POLICY reward_claims_merchant_read ON public."RewardClaim"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('RewardClaim'))
    OR (EXISTS (
      SELECT 1 FROM public."Reward" r
      WHERE r.id = "RewardClaim"."rewardId"
        AND app_tenant_org_member(r."tenantId")
    ))
  );

-- Redemptions and paid POS bills are financial records written only by the
-- POS checkout (a verified merchant API key, system context). The customer and
-- the merchant's members may READ them; nobody writes them from a user session.
DROP POLICY IF EXISTS reward_redemptions_access ON public."RewardRedemption";
DROP POLICY IF EXISTS reward_redemptions_select ON public."RewardRedemption";
CREATE POLICY reward_redemptions_select ON public."RewardRedemption"
  FOR SELECT
  USING (
    app_owns("userId")
    OR app_tenant_org_member("tenantId")
    OR (SELECT app_rls_bypass_on('RewardRedemption'))
  );
DROP POLICY IF EXISTS reward_redemptions_system_write ON public."RewardRedemption";
CREATE POLICY reward_redemptions_system_write ON public."RewardRedemption"
  USING ((SELECT app_rls_bypass_on('RewardRedemption')))
  WITH CHECK ((SELECT app_rls_bypass_on('RewardRedemption')));

DROP POLICY IF EXISTS reward_sales_access ON public."RewardSale";
DROP POLICY IF EXISTS reward_sales_select ON public."RewardSale";
CREATE POLICY reward_sales_select ON public."RewardSale"
  FOR SELECT
  USING (
    app_owns("userId")
    OR app_tenant_org_member("tenantId")
    OR (SELECT app_rls_bypass_on('RewardSale'))
  );
DROP POLICY IF EXISTS reward_sales_system_write ON public."RewardSale";
CREATE POLICY reward_sales_system_write ON public."RewardSale"
  USING ((SELECT app_rls_bypass_on('RewardSale')))
  WITH CHECK ((SELECT app_rls_bypass_on('RewardSale')));

DROP POLICY IF EXISTS reward_referrals_parties ON public."RewardReferral";
CREATE POLICY reward_referrals_parties ON public."RewardReferral"
  USING (
    app_owns("referrerUserId")
    OR app_owns("refereeUserId")
    OR (SELECT app_rls_bypass_on('RewardReferral'))
  )
  WITH CHECK ((SELECT app_rls_bypass_on('RewardReferral')));

DROP POLICY IF EXISTS signup_referral_codes_own ON public."SignupReferralCode";
CREATE POLICY signup_referral_codes_own ON public."SignupReferralCode"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('SignupReferralCode')))
  WITH CHECK ((SELECT app_rls_bypass_on('SignupReferralCode')));

DROP POLICY IF EXISTS signup_referrals_referrer ON public."SignupReferral";
CREATE POLICY signup_referrals_referrer ON public."SignupReferral"
  USING (app_owns("referrerUserId") OR (SELECT app_rls_bypass_on('SignupReferral')))
  WITH CHECK ((SELECT app_rls_bypass_on('SignupReferral')));

DROP POLICY IF EXISTS reward_otp_own ON public."RewardOtpChallenge";
CREATE POLICY reward_otp_own ON public."RewardOtpChallenge"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardOtpChallenge')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardOtpChallenge')));

DROP POLICY IF EXISTS reward_legal_own ON public."RewardLegalAcceptance";
CREATE POLICY reward_legal_own ON public."RewardLegalAcceptance"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardLegalAcceptance')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardLegalAcceptance')));

DROP POLICY IF EXISTS reward_notifications_own ON public."RewardNotification";
CREATE POLICY reward_notifications_own ON public."RewardNotification"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardNotification')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardNotification')));

DROP POLICY IF EXISTS reward_audit_insert ON public."RewardAuditLog";
CREATE POLICY reward_audit_insert ON public."RewardAuditLog"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('RewardAuditLog')) OR ("tenantId" IS NOT NULL AND app_tenant_org_member("tenantId")));

DROP POLICY IF EXISTS reward_audit_select ON public."RewardAuditLog";
CREATE POLICY reward_audit_select ON public."RewardAuditLog"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('RewardAuditLog'))
    OR ("tenantId" IS NOT NULL AND app_tenant_org_member("tenantId"))
  );

-- Internal infrastructure tables — bypass-only (never user-scoped reads/writes).
DROP POLICY IF EXISTS outbox_events_bypass ON public."OutboxEvent";
CREATE POLICY outbox_events_bypass ON public."OutboxEvent"
  USING ((SELECT app_rls_bypass_on('OutboxEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('OutboxEvent')));

-- Transactional outbox (docs/adr/015-transactional-outbox-and-inbox.md): an
-- event row is written in the SAME transaction as the domain change it
-- describes, and that transaction runs under the caller's (usually
-- user/tenant-scoped, non-bypass) RLS session. This policy lets any app
-- session APPEND a fresh PENDING row — nothing more: no SELECT (so no
-- INSERT … RETURNING; the producer assigns the id), no UPDATE/DELETE, and no
-- pre-published / pre-failed / pre-attempted rows. Reading and advancing rows
-- stays bypass-only (the dispatcher runs as the `outbox.publish` system op).
DROP POLICY IF EXISTS outbox_events_append ON public."OutboxEvent";
CREATE POLICY outbox_events_append ON public."OutboxEvent"
  FOR INSERT
  WITH CHECK (status = 'PENDING' AND attempts = 0 AND "publishedAt" IS NULL AND "lastError" IS NULL);

DROP POLICY IF EXISTS analytics_events_bypass ON public."AnalyticsEvent";
CREATE POLICY analytics_events_bypass ON public."AnalyticsEvent"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('AnalyticsEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('AnalyticsEvent')));

-- Consumer inbox ledger + parked poison messages. Never user-visible. The
-- bypass policies above/below apply to `app_runtime` only (operator tooling);
-- apps/analytics-consumer writes as its own least-privilege role, whose grants
-- and policies live in prisma/rls/90-analytics-consumer.sql.
DROP POLICY IF EXISTS inbox_processed_events_bypass ON public."InboxProcessedEvent";
CREATE POLICY inbox_processed_events_bypass ON public."InboxProcessedEvent"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('InboxProcessedEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('InboxProcessedEvent')));

DROP POLICY IF EXISTS inbox_dead_letters_bypass ON public."InboxDeadLetter";
CREATE POLICY inbox_dead_letters_bypass ON public."InboxDeadLetter"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('InboxDeadLetter')))
  WITH CHECK ((SELECT app_rls_bypass_on('InboxDeadLetter')));

-- Global HTTP audit log (docs/adr/025-global-http-audit-log.md): append-only.
-- Rows are INSERTed under a named system operation — `audit.http_request.record`
-- (AuditLogInterceptor / GlobalExceptionFilter) or the operation of a handler's
-- own system transaction (AuditTrailService.recordInTransaction). Reading is
-- bypass-only; UPDATE/DELETE are revoked from app_runtime in
-- 99-app-runtime-grants.sql (it re-grants table privileges, so the revoke must
-- run after it).
DROP POLICY IF EXISTS audit_logs_insert ON public."AuditLog";
CREATE POLICY audit_logs_insert ON public."AuditLog"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('AuditLog')));

DROP POLICY IF EXISTS audit_logs_select ON public."AuditLog";
CREATE POLICY audit_logs_select ON public."AuditLog"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('AuditLog')));

-- Row-level data-change trail (docs/adr/051-database-change-audit-trail.md):
-- append-only. Rows are INSERTed ONLY by the generated `data_change_capture`
-- triggers (prisma/rls/data-change-capture.ts, applied by prisma/rls/apply.ts
-- after this bundle): `pg_trigger_depth() > 0` is true only while a trigger
-- runs, and app_runtime cannot create triggers or functions, so application
-- SQL can never forge or pre-write a change record. Reading is bypass-only
-- (the admin viewer's `audit.data_change.read`); UPDATE/DELETE are withheld
-- from app_runtime (prisma/rls/withheld-privileges.ts).
DROP POLICY IF EXISTS data_change_logs_insert ON public."DataChangeLog";
CREATE POLICY data_change_logs_insert ON public."DataChangeLog"
  FOR INSERT
  WITH CHECK (pg_trigger_depth() > 0);

DROP POLICY IF EXISTS data_change_logs_select ON public."DataChangeLog";
CREATE POLICY data_change_logs_select ON public."DataChangeLog"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('DataChangeLog')));

DROP POLICY IF EXISTS platform_resource_idempotency_bypass ON public."PlatformResourceIdempotencyRecord";
CREATE POLICY platform_resource_idempotency_bypass ON public."PlatformResourceIdempotencyRecord"
  USING ((SELECT app_rls_bypass_on('PlatformResourceIdempotencyRecord')))
  WITH CHECK ((SELECT app_rls_bypass_on('PlatformResourceIdempotencyRecord')));
-- ── Tenant multi-tenancy (docs/technical/authorization/tenancy-and-rls.md) ───────────────────
-- ReBAC helpers: prisma/rls/01-acl-location-access.sql (applied before this bundle).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Tenant',
    'TenantSlugHistory',
    'Location',
    'Membership',
    'MembershipLocationScope',
    'TenantMerchantProfile',
    'TenantInvitation',
    'TenantInvitationLocationScope',
    'TenantAccessRequest',
    'TenantSuspensionAppeal',
    'TenantCustomerBan',
    'TenantLifecycleEvent',
    'TenantPlacement',
    'AuthorizationPolicyDraft',
    'AuthorizationPolicyVersion',
    'SupportAccessGrant',
    'TenantEncryptionKey',
    'TenantAuditLog'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS tenants_member ON public."Tenant";
CREATE POLICY tenants_member ON public."Tenant"
  FOR SELECT
  USING (
    (SELECT app_rls_bypass_on('Tenant'))
    OR app_member_of(id)
    OR (
      app_current_user_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."Membership" m
        WHERE m."tenantId" = "Tenant".id
          AND m."userId" = app_current_user_id()
          AND m.status = 'ACTIVE'
          AND m."isDeleted" = false
      )
    )
  );

DROP POLICY IF EXISTS tenants_write ON public."Tenant";
CREATE POLICY tenants_write ON public."Tenant"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('Tenant')))
  WITH CHECK ((SELECT app_rls_bypass_on('Tenant')));

DROP POLICY IF EXISTS tenant_tables ON public."Location";
DROP POLICY IF EXISTS locations_member ON public."Location";
CREATE POLICY locations_member ON public."Location"
  USING (
    (SELECT app_rls_bypass_on('Location'))
    OR app_tenant_member_of("tenantId")
    OR app_member_of("tenantId")
  )
  WITH CHECK (
    (SELECT app_rls_bypass_on('Location'))
    OR app_tenant_member_of("tenantId")
    OR app_member_of("tenantId")
  );

DROP POLICY IF EXISTS tenant_memberships_member ON public."Membership";
CREATE POLICY tenant_memberships_member ON public."Membership"
  USING ((SELECT app_rls_bypass_on('Membership')) OR app_tenant_member_of("tenantId"))
  WITH CHECK ((SELECT app_rls_bypass_on('Membership')) OR app_tenant_member_of("tenantId"));

DROP POLICY IF EXISTS tenant_audit_logs_member ON public."TenantAuditLog";
CREATE POLICY tenant_audit_logs_member ON public."TenantAuditLog"
  USING ((SELECT app_rls_bypass_on('TenantAuditLog')) OR app_tenant_member_of("tenantId"))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantAuditLog')) OR app_tenant_member_of("tenantId"));

DROP POLICY IF EXISTS tenant_access_requests_policy ON public."TenantAccessRequest";
DROP POLICY IF EXISTS tenant_access_requests_select ON public."TenantAccessRequest";
DROP POLICY IF EXISTS tenant_access_requests_insert ON public."TenantAccessRequest";
CREATE POLICY tenant_access_requests_select ON public."TenantAccessRequest"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('TenantAccessRequest')) OR app_tenant_member_of("tenantId") OR "userId" = app_current_user_id());
CREATE POLICY tenant_access_requests_insert ON public."TenantAccessRequest"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('TenantAccessRequest')) OR "userId" = app_current_user_id());
-- Reviewing (the PENDING → APPROVED/REJECTED compare-and-set) runs only as the
-- `tenant.access_request.review` system operation, after the reviewer's
-- manage-team check. Without an UPDATE policy forced RLS matches no row, so the
-- claim updated nothing and every review reported "already reviewed" (409).
DROP POLICY IF EXISTS tenant_access_requests_review ON public."TenantAccessRequest";
CREATE POLICY tenant_access_requests_review ON public."TenantAccessRequest"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('TenantAccessRequest')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantAccessRequest')));

-- Suspension appeals (MT-23): the tenant's members read their tenant's appeals; every write
-- (submit, accept, reject) runs as its own system operation after the route's checks.
DROP POLICY IF EXISTS tenant_suspension_appeals_select ON public."TenantSuspensionAppeal";
DROP POLICY IF EXISTS tenant_suspension_appeals_write ON public."TenantSuspensionAppeal";
CREATE POLICY tenant_suspension_appeals_select ON public."TenantSuspensionAppeal"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('TenantSuspensionAppeal')) OR app_tenant_member_of("tenantId"));
CREATE POLICY tenant_suspension_appeals_write ON public."TenantSuspensionAppeal"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('TenantSuspensionAppeal')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantSuspensionAppeal')));

-- Customer bans: the tenant's members read their tenant's bans (the redemption log's "banned"
-- badge, the banned-customers page); every write (ban, lift) runs as its own system operation
-- after the route's capability check. Claims and the tills read them inside their own operations.
DROP POLICY IF EXISTS tenant_customer_bans_select ON public."TenantCustomerBan";
DROP POLICY IF EXISTS tenant_customer_bans_write ON public."TenantCustomerBan";
CREATE POLICY tenant_customer_bans_select ON public."TenantCustomerBan"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('TenantCustomerBan')) OR app_tenant_member_of("tenantId"));
CREATE POLICY tenant_customer_bans_write ON public."TenantCustomerBan"
  FOR ALL
  USING ((SELECT app_rls_bypass_on('TenantCustomerBan')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantCustomerBan')));

DROP POLICY IF EXISTS tenant_merchant_profiles_member ON public."TenantMerchantProfile";
CREATE POLICY tenant_merchant_profiles_member ON public."TenantMerchantProfile"
  USING ((SELECT app_rls_bypass_on('TenantMerchantProfile')) OR app_tenant_org_member("tenantId"))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantMerchantProfile')) OR app_tenant_org_member("tenantId"));

-- Remaining tenant tables: tenant member read, bypass write for sagas.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'TenantSlugHistory',
    'MembershipLocationScope',
    'TenantInvitation',
    'TenantInvitationLocationScope',
    'TenantLifecycleEvent',
    'TenantPlacement',
    'AuthorizationPolicyDraft',
    'AuthorizationPolicyVersion',
    'SupportAccessGrant',
    'TenantEncryptionKey'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_member', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING ((SELECT app_rls_bypass_on(%L)) OR app_tenant_member_of("tenantId")) WITH CHECK ((SELECT app_rls_bypass_on(%L)))',
      tbl || '_member', tbl, tbl, tbl
    );
  END LOOP;
END $$;

ALTER TABLE public."AuthorizationPolicySimulation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthorizationPolicySimulation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authorization_policy_simulations_bypass ON public."AuthorizationPolicySimulation";
CREATE POLICY authorization_policy_simulations_bypass ON public."AuthorizationPolicySimulation"
  USING ((SELECT app_rls_bypass_on('AuthorizationPolicySimulation')))
  WITH CHECK ((SELECT app_rls_bypass_on('AuthorizationPolicySimulation')));

-- RLS for SampleCategory (admin-only)
ALTER TABLE "SampleCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SampleCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sample_category_select ON "SampleCategory";
DROP POLICY IF EXISTS sample_category_insert ON "SampleCategory";
DROP POLICY IF EXISTS sample_category_update ON "SampleCategory";
DROP POLICY IF EXISTS sample_category_delete ON "SampleCategory";
CREATE POLICY sample_category_select ON "SampleCategory" FOR SELECT USING ((SELECT app_rls_bypass_on('SampleCategory')));
CREATE POLICY sample_category_insert ON "SampleCategory" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('SampleCategory')));
CREATE POLICY sample_category_update ON "SampleCategory" FOR UPDATE USING ((SELECT app_rls_bypass_on('SampleCategory'))) WITH CHECK ((SELECT app_rls_bypass_on('SampleCategory')));
CREATE POLICY sample_category_delete ON "SampleCategory" FOR DELETE USING ((SELECT app_rls_bypass_on('SampleCategory')));
-- RLS for Product (admin-only)
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_select ON "Product";
DROP POLICY IF EXISTS product_insert ON "Product";
DROP POLICY IF EXISTS product_update ON "Product";
DROP POLICY IF EXISTS product_delete ON "Product";
CREATE POLICY product_select ON "Product" FOR SELECT USING ((SELECT app_rls_bypass_on('Product')));
CREATE POLICY product_insert ON "Product" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('Product')));
CREATE POLICY product_update ON "Product" FOR UPDATE USING ((SELECT app_rls_bypass_on('Product'))) WITH CHECK ((SELECT app_rls_bypass_on('Product')));
CREATE POLICY product_delete ON "Product" FOR DELETE USING ((SELECT app_rls_bypass_on('Product')));

-- RLS for the kanban boards (platform staff only). Bypass-only: reached through
-- `kanban.board.read` / `kanban.board.write` after the KANBAN_TASK permission
-- check; `files.delete` also updates KanbanTaskAttachment when an attached file
-- is deleted. No DELETE policy: board rows are soft-deleted, never removed
-- (and app_runtime holds no DELETE on them — rls/withheld-privileges.ts).
ALTER TABLE "KanbanColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanColumn" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_column_select ON "KanbanColumn";
DROP POLICY IF EXISTS kanban_column_insert ON "KanbanColumn";
DROP POLICY IF EXISTS kanban_column_update ON "KanbanColumn";
CREATE POLICY kanban_column_select ON "KanbanColumn" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanColumn')));
CREATE POLICY kanban_column_insert ON "KanbanColumn" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanColumn')));
CREATE POLICY kanban_column_update ON "KanbanColumn" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanColumn'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanColumn')));
ALTER TABLE "KanbanPlanningColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanPlanningColumn" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_planning_column_select ON "KanbanPlanningColumn";
DROP POLICY IF EXISTS kanban_planning_column_insert ON "KanbanPlanningColumn";
DROP POLICY IF EXISTS kanban_planning_column_update ON "KanbanPlanningColumn";
CREATE POLICY kanban_planning_column_select ON "KanbanPlanningColumn" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));
CREATE POLICY kanban_planning_column_insert ON "KanbanPlanningColumn" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));
CREATE POLICY kanban_planning_column_update ON "KanbanPlanningColumn" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanPlanningColumn'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));
ALTER TABLE "KanbanExecutionColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanExecutionColumn" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_execution_column_select ON "KanbanExecutionColumn";
DROP POLICY IF EXISTS kanban_execution_column_insert ON "KanbanExecutionColumn";
DROP POLICY IF EXISTS kanban_execution_column_update ON "KanbanExecutionColumn";
CREATE POLICY kanban_execution_column_select ON "KanbanExecutionColumn" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));
CREATE POLICY kanban_execution_column_insert ON "KanbanExecutionColumn" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));
CREATE POLICY kanban_execution_column_update ON "KanbanExecutionColumn" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanExecutionColumn'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));
ALTER TABLE "KanbanLevelCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanLevelCounter" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_level_counter_select ON "KanbanLevelCounter";
DROP POLICY IF EXISTS kanban_level_counter_insert ON "KanbanLevelCounter";
DROP POLICY IF EXISTS kanban_level_counter_update ON "KanbanLevelCounter";
CREATE POLICY kanban_level_counter_select ON "KanbanLevelCounter" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanLevelCounter')));
CREATE POLICY kanban_level_counter_insert ON "KanbanLevelCounter" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanLevelCounter')));
CREATE POLICY kanban_level_counter_update ON "KanbanLevelCounter" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanLevelCounter'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanLevelCounter')));
ALTER TABLE "KanbanConversionStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanConversionStage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_conversion_stage_select ON "KanbanConversionStage";
DROP POLICY IF EXISTS kanban_conversion_stage_insert ON "KanbanConversionStage";
DROP POLICY IF EXISTS kanban_conversion_stage_update ON "KanbanConversionStage";
CREATE POLICY kanban_conversion_stage_select ON "KanbanConversionStage" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanConversionStage')));
CREATE POLICY kanban_conversion_stage_insert ON "KanbanConversionStage" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanConversionStage')));
CREATE POLICY kanban_conversion_stage_update ON "KanbanConversionStage" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanConversionStage'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanConversionStage')));
ALTER TABLE "KanbanTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTask" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_select ON "KanbanTask";
DROP POLICY IF EXISTS kanban_task_insert ON "KanbanTask";
DROP POLICY IF EXISTS kanban_task_update ON "KanbanTask";
CREATE POLICY kanban_task_select ON "KanbanTask" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTask')));
CREATE POLICY kanban_task_insert ON "KanbanTask" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTask')));
CREATE POLICY kanban_task_update ON "KanbanTask" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTask'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTask')));
ALTER TABLE "KanbanTaskComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTaskComment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_comment_select ON "KanbanTaskComment";
DROP POLICY IF EXISTS kanban_task_comment_insert ON "KanbanTaskComment";
DROP POLICY IF EXISTS kanban_task_comment_update ON "KanbanTaskComment";
CREATE POLICY kanban_task_comment_select ON "KanbanTaskComment" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTaskComment')));
CREATE POLICY kanban_task_comment_insert ON "KanbanTaskComment" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskComment')));
CREATE POLICY kanban_task_comment_update ON "KanbanTaskComment" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTaskComment'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskComment')));
ALTER TABLE "KanbanTaskAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTaskAttachment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_attachment_select ON "KanbanTaskAttachment";
DROP POLICY IF EXISTS kanban_task_attachment_insert ON "KanbanTaskAttachment";
DROP POLICY IF EXISTS kanban_task_attachment_update ON "KanbanTaskAttachment";
CREATE POLICY kanban_task_attachment_select ON "KanbanTaskAttachment" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));
CREATE POLICY kanban_task_attachment_insert ON "KanbanTaskAttachment" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));
CREATE POLICY kanban_task_attachment_update ON "KanbanTaskAttachment" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTaskAttachment'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));
ALTER TABLE "KanbanChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanChecklistItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_checklist_item_select ON "KanbanChecklistItem";
DROP POLICY IF EXISTS kanban_checklist_item_insert ON "KanbanChecklistItem";
DROP POLICY IF EXISTS kanban_checklist_item_update ON "KanbanChecklistItem";
CREATE POLICY kanban_checklist_item_select ON "KanbanChecklistItem" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanChecklistItem')));
CREATE POLICY kanban_checklist_item_insert ON "KanbanChecklistItem" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanChecklistItem')));
CREATE POLICY kanban_checklist_item_update ON "KanbanChecklistItem" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanChecklistItem'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanChecklistItem')));
ALTER TABLE "KanbanTaskWatcher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTaskWatcher" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_watcher_select ON "KanbanTaskWatcher";
DROP POLICY IF EXISTS kanban_task_watcher_insert ON "KanbanTaskWatcher";
DROP POLICY IF EXISTS kanban_task_watcher_update ON "KanbanTaskWatcher";
CREATE POLICY kanban_task_watcher_select ON "KanbanTaskWatcher" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));
CREATE POLICY kanban_task_watcher_insert ON "KanbanTaskWatcher" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));
CREATE POLICY kanban_task_watcher_update ON "KanbanTaskWatcher" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTaskWatcher'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));
ALTER TABLE "KanbanTaskLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTaskLink" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_link_select ON "KanbanTaskLink";
DROP POLICY IF EXISTS kanban_task_link_insert ON "KanbanTaskLink";
DROP POLICY IF EXISTS kanban_task_link_update ON "KanbanTaskLink";
CREATE POLICY kanban_task_link_select ON "KanbanTaskLink" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTaskLink')));
CREATE POLICY kanban_task_link_insert ON "KanbanTaskLink" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskLink')));
CREATE POLICY kanban_task_link_update ON "KanbanTaskLink" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTaskLink'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskLink')));
ALTER TABLE "KanbanTaskActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanTaskActivity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_task_activity_select ON "KanbanTaskActivity";
DROP POLICY IF EXISTS kanban_task_activity_insert ON "KanbanTaskActivity";
DROP POLICY IF EXISTS kanban_task_activity_update ON "KanbanTaskActivity";
CREATE POLICY kanban_task_activity_select ON "KanbanTaskActivity" FOR SELECT USING ((SELECT app_rls_bypass_on('KanbanTaskActivity')));
CREATE POLICY kanban_task_activity_insert ON "KanbanTaskActivity" FOR INSERT WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskActivity')));
CREATE POLICY kanban_task_activity_update ON "KanbanTaskActivity" FOR UPDATE USING ((SELECT app_rls_bypass_on('KanbanTaskActivity'))) WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskActivity')));
