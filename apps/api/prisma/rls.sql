-- ============================================================================
-- Row-Level Security — main bundle (idempotent)
-- ============================================================================
-- Prisma migrations do NOT emit RLS. Do not append this SQL to migration.sql
-- (squashed migrations would drop it). Security is applied automatically by:
--
--   pnpm db:migrate | db:deploy | db:reset | db:push
--
-- via `scripts/apply-rls.ts` — apply order + fresh-database validation live in
-- `RLS_APPLY_ORDER` (scripts/rls-apply-plan.ts).
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
GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_organization_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_owns(text) TO app_runtime;

-- ── 3. Enable RLS on every table ───────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'roles',
    'permissions',
    'capability_definitions',
    'permission_audit_logs',
    'password_reset_tokens',
    'password_history',
    'backup_codes',
    'two_factor_pending_setups',
    'two_factor_login_challenges',
    'mfa_recovery_requests',
    'user_roles',
    'user_permissions',
    'role_permissions',
    'refresh_tokens',
    'urls',
    'tags',
    'url_tags',
    'clicks',
    'api_keys',
    'impersonation_audit_logs',
    'logs',
    'api_key_usage_logs',
    'email_logs',
    'email_delivery_events',
    'outbox_events',
    'analytics_events',
    'inbox_processed_events',
    'inbox_dead_letters',
    'audit_logs',
    'platform_resource_idempotency_records'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 4. Policies ────────────────────────────────────────────────────────────

-- ── Ownership policies (user-scoped tables) ────────────────────────────────

DROP POLICY IF EXISTS users_own ON public.users;
CREATE POLICY users_own ON public.users
  USING (app_owns(id))
  WITH CHECK (app_owns(id));

DROP POLICY IF EXISTS urls_own ON public.urls;
CREATE POLICY urls_own ON public.urls
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS tags_own ON public.tags;
CREATE POLICY tags_own ON public.tags
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS url_tags_via_url ON public.url_tags;
CREATE POLICY url_tags_via_url ON public.url_tags
  USING (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)));

DROP POLICY IF EXISTS clicks_via_url ON public.clicks;
CREATE POLICY clicks_via_url ON public.clicks
  USING (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)));

DROP POLICY IF EXISTS api_keys_own ON public.api_keys;
CREATE POLICY api_keys_own ON public.api_keys
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS api_key_usage_via_key ON public.api_key_usage_logs;
CREATE POLICY api_key_usage_via_key ON public.api_key_usage_logs
  USING (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND app_owns(k.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND app_owns(k.user_id)));

DROP POLICY IF EXISTS refresh_tokens_own ON public.refresh_tokens;
CREATE POLICY refresh_tokens_own ON public.refresh_tokens
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

DROP POLICY IF EXISTS password_reset_tokens_own ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_own ON public.password_reset_tokens
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS password_history_own ON public.password_history;
CREATE POLICY password_history_own ON public.password_history
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS backup_codes_own ON public.backup_codes;
CREATE POLICY backup_codes_own ON public.backup_codes
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS two_factor_pending_setups_own ON public.two_factor_pending_setups;
CREATE POLICY two_factor_pending_setups_own ON public.two_factor_pending_setups
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS two_factor_login_challenges_own ON public.two_factor_login_challenges;
CREATE POLICY two_factor_login_challenges_own ON public.two_factor_login_challenges
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS mfa_recovery_requests_own ON public.mfa_recovery_requests;
CREATE POLICY mfa_recovery_requests_own ON public.mfa_recovery_requests
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS user_roles_own ON public.user_roles;
CREATE POLICY user_roles_own ON public.user_roles
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

DROP POLICY IF EXISTS user_permissions_own ON public.user_permissions;
CREATE POLICY user_permissions_own ON public.user_permissions
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

-- ── Shared / RBAC tables (world-readable, bypass-only writes) ──────────────

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS roles_write ON public.roles;
CREATE POLICY roles_write ON public.roles
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS permissions_write ON public.permissions;
CREATE POLICY permissions_write ON public.permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS capability_definitions_read ON public.capability_definitions;
CREATE POLICY capability_definitions_read ON public.capability_definitions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS capability_definitions_write ON public.capability_definitions;
CREATE POLICY capability_definitions_write ON public.capability_definitions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Authorization kernel (ACL, policies, audit) ────────────────────────────

ALTER TABLE public.resource_acls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_acls FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_acls_member ON public.resource_acls;
CREATE POLICY resource_acls_member ON public.resource_acls
  USING (
    app_rls_bypass()
    OR organization_id IS NULL
    OR app_tenant_organization_member_of(organization_id)
  )
  WITH CHECK (app_rls_bypass());

ALTER TABLE public.policy_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_definitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_definitions_read ON public.policy_definitions;
CREATE POLICY policy_definitions_read ON public.policy_definitions
  FOR SELECT
  USING (
    app_rls_bypass()
    OR organization_id IS NULL
    OR app_tenant_organization_member_of(organization_id)
  );

DROP POLICY IF EXISTS policy_definitions_write ON public.policy_definitions;
CREATE POLICY policy_definitions_write ON public.policy_definitions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE public.authorization_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_audits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_audits_bypass ON public.authorization_audits;
CREATE POLICY authorization_audits_bypass ON public.authorization_audits
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Append-mostly tables (insert public, select/update/delete via bypass) ──

DROP POLICY IF EXISTS logs_bypass ON public.logs;
DROP POLICY IF EXISTS logs_insert ON public.logs;
DROP POLICY IF EXISTS logs_select ON public.logs;
DROP POLICY IF EXISTS logs_update ON public.logs;
DROP POLICY IF EXISTS logs_delete ON public.logs;
CREATE POLICY logs_insert ON public.logs FOR INSERT WITH CHECK (true);
CREATE POLICY logs_select ON public.logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY logs_update ON public.logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY logs_delete ON public.logs FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS email_logs_bypass ON public.email_logs;
DROP POLICY IF EXISTS email_logs_insert ON public.email_logs;
DROP POLICY IF EXISTS email_logs_select ON public.email_logs;
DROP POLICY IF EXISTS email_logs_update ON public.email_logs;
DROP POLICY IF EXISTS email_logs_delete ON public.email_logs;
CREATE POLICY email_logs_insert ON public.email_logs FOR INSERT WITH CHECK (true);
CREATE POLICY email_logs_select ON public.email_logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY email_logs_update ON public.email_logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY email_logs_delete ON public.email_logs FOR DELETE USING (app_rls_bypass());

-- Resend delivery-webhook history (one row per verified webhook delivery). Written
-- and read only by the signature-verified webhook route (@RlsBypass) — bypass-only.
DROP POLICY IF EXISTS email_delivery_events_bypass ON public.email_delivery_events;
CREATE POLICY email_delivery_events_bypass ON public.email_delivery_events
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Audit tables (bypass-only) ─────────────────────────────────────────────

DROP POLICY IF EXISTS permission_audit_logs_bypass ON public.permission_audit_logs;
CREATE POLICY permission_audit_logs_bypass ON public.permission_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_bypass ON public.impersonation_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Impersonation audit is append-only for app_runtime: UPDATE/DELETE are withheld
-- via prisma/rls/withheld-privileges.ts (revoked after the blanket grant in 99).

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public.impersonation_audit_logs;

DROP POLICY IF EXISTS impersonation_audit_logs_select ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_select ON public.impersonation_audit_logs
  FOR SELECT
  TO app_runtime
  USING (app_rls_bypass());

DROP POLICY IF EXISTS impersonation_audit_logs_insert ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_insert ON public.impersonation_audit_logs
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_rls_bypass());

-- Impersonation sessions: written under `platform.superadmin` / `route.rls_bypass`,
-- read by AuthGuard under `request.pre_handler` — every path is a bypass scope.
-- Rows are never deleted (ended sessions are part of the forensic record).
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impersonation_sessions_bypass ON public.impersonation_sessions;
CREATE POLICY impersonation_sessions_bypass ON public.impersonation_sessions
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
-- DELETE is withheld from app_runtime via prisma/rls/withheld-privileges.ts.

-- MFA recovery audit: append-only domain audit, written only inside the
-- `auth.mfa_recovery.*` / `maintenance.mfa_recovery_unlock` system operations.
ALTER TABLE public.mfa_recovery_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recovery_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfa_recovery_audit_logs_select ON public.mfa_recovery_audit_logs;
CREATE POLICY mfa_recovery_audit_logs_select ON public.mfa_recovery_audit_logs
  FOR SELECT
  TO app_runtime
  USING (app_rls_bypass());

DROP POLICY IF EXISTS mfa_recovery_audit_logs_insert ON public.mfa_recovery_audit_logs;
CREATE POLICY mfa_recovery_audit_logs_insert ON public.mfa_recovery_audit_logs
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_rls_bypass());
-- UPDATE/DELETE are withheld from app_runtime via prisma/rls/withheld-privileges.ts.

-- ── Geo tables (reference data: public read, SuperAdmin write) ───────────
-- Writes are allowed ONLY under the `geo.reference_data.write` system
-- operation (GeoRepository, SuperAdmin-only endpoints) — not under any other
-- bypass, not even `platform.superadmin`. Rows are soft-deleted: DELETE is
-- revoked from app_runtime in 99-app-runtime-grants.sql.

ALTER TABLE IF EXISTS public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regions_read ON public.regions;
CREATE POLICY regions_read ON public.regions
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS regions_write ON public.regions;
CREATE POLICY regions_write ON public.regions
  FOR ALL
  USING (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write')
  WITH CHECK (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write');

ALTER TABLE IF EXISTS public.subregions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subregions_read ON public.subregions;
CREATE POLICY subregions_read ON public.subregions
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS subregions_write ON public.subregions;
CREATE POLICY subregions_write ON public.subregions
  FOR ALL
  USING (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write')
  WITH CHECK (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write');

ALTER TABLE IF EXISTS public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS countries_read ON public.countries;
CREATE POLICY countries_read ON public.countries
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS countries_write ON public.countries;
CREATE POLICY countries_write ON public.countries
  FOR ALL
  USING (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write')
  WITH CHECK (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write');

ALTER TABLE IF EXISTS public.states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS states_read ON public.states;
CREATE POLICY states_read ON public.states
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS states_write ON public.states;
CREATE POLICY states_write ON public.states
  FOR ALL
  USING (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write')
  WITH CHECK (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write');

ALTER TABLE IF EXISTS public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cities_read ON public.cities;
CREATE POLICY cities_read ON public.cities
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS cities_write ON public.cities;
CREATE POLICY cities_write ON public.cities
  FOR ALL
  USING (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write')
  WITH CHECK (app_rls_bypass() AND app_system_operation() = 'geo.reference_data.write');

-- ── Rewards platform (organization-scoped — ReBAC via app_tenant_org_member in 01) ─

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_api_keys',
    'organization_terminals',
    'rewards',
    'reward_claims',
    'reward_redemptions',
    'reward_sales',
    'reward_referrals',
    'reward_otp_challenges',
    'reward_legal_acceptances',
    'reward_notifications',
    'reward_audit_logs',
    'stored_files',
    'file_variants',
    'product_images',
    'organization_assets',
    'user_avatars',
    'organization_kyb_files'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS stored_files_owner ON public.stored_files;
CREATE POLICY stored_files_owner ON public.stored_files
  USING (app_owns(uploaded_by_id) OR (organization_id IS NOT NULL AND app_tenant_org_member(organization_id)) OR app_rls_bypass())
  WITH CHECK (app_owns(uploaded_by_id) OR (organization_id IS NOT NULL AND app_tenant_org_member(organization_id)) OR app_rls_bypass());

DROP POLICY IF EXISTS file_variants_file ON public.file_variants;
CREATE POLICY file_variants_file ON public.file_variants
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (app_owns(sf.uploaded_by_id) OR (sf.organization_id IS NOT NULL AND app_tenant_org_member(sf.organization_id)))
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (app_owns(sf.uploaded_by_id) OR (sf.organization_id IS NOT NULL AND app_tenant_org_member(sf.organization_id)))
    )
  );

DROP POLICY IF EXISTS product_images_catalog ON public.product_images;
CREATE POLICY product_images_catalog ON public.product_images
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS organization_assets_org ON public.organization_assets;
CREATE POLICY organization_assets_org ON public.organization_assets
  USING (app_tenant_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_tenant_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS user_avatars_owner ON public.user_avatars;
CREATE POLICY user_avatars_owner ON public.user_avatars
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS organization_kyb_files_org ON public.organization_kyb_files;
CREATE POLICY organization_kyb_files_org ON public.organization_kyb_files
  USING (app_tenant_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_tenant_org_member(organization_id) OR app_rls_bypass());

-- The session's user holds a (non-deleted) claim on the reward. A claim is the
-- user's own record, so the reward it names stays readable to them after the
-- reward stops being public (expired, disabled, archived, soft-deleted) — the
-- wallet and claim history must still show what was claimed. SECURITY DEFINER
-- so it reads reward_claims without re-entering that table's policies, one of
-- which (reward_claims_merchant_read) reads rewards — a policy cycle Postgres
-- rejects. Fail-closed: no user in the session, no access.
CREATE OR REPLACE FUNCTION app_holds_reward_claim(reward_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.reward_claims c
      WHERE c.reward_id = app_holds_reward_claim.reward_id
        AND c.user_id = app_current_user_id()
        AND c.is_deleted = false
    );
$$;

GRANT EXECUTE ON FUNCTION app_holds_reward_claim(text) TO app_runtime;

-- Published consumer rewards are marketplace-readable; org members see all org
-- rewards; a claim holder sees the reward they claimed, whatever its state now.
DROP POLICY IF EXISTS rewards_read ON public.rewards;
CREATE POLICY rewards_read ON public.rewards
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_tenant_org_member(organization_id)
    OR (
      is_deleted = false
      AND reward_kind = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
    OR app_holds_reward_claim(id)
  );

DROP POLICY IF EXISTS rewards_write ON public.rewards;
CREATE POLICY rewards_write ON public.rewards
  FOR INSERT
  WITH CHECK (app_tenant_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_update ON public.rewards;
CREATE POLICY rewards_update ON public.rewards
  FOR UPDATE
  USING (app_tenant_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_tenant_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_delete ON public.rewards;
CREATE POLICY rewards_delete ON public.rewards
  FOR DELETE
  USING (app_tenant_org_member(organization_id) OR app_rls_bypass());

ALTER TABLE public.reward_location_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_location_scopes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_location_scopes_read ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_read ON public.reward_location_scopes
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_tenant_org_member(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.rewards r
      WHERE r.id = reward_location_scopes.reward_id
        AND r.is_deleted = false
        AND r.reward_kind = 'CONSUMER'
        AND r.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS reward_location_scopes_write ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_write ON public.reward_location_scopes
  FOR ALL
  USING (app_tenant_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_tenant_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_claims_own ON public.reward_claims;
CREATE POLICY reward_claims_own ON public.reward_claims
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

-- The merchant's members may READ the claims of their organization's rewards
-- (redemption history and analytics join a redemption to its claim and reward).
-- Read-only: claims are written by the customer (own row) or system flows.
-- Store scope within the organization is enforced by the API service layer.
DROP POLICY IF EXISTS reward_claims_merchant_read ON public.reward_claims;
CREATE POLICY reward_claims_merchant_read ON public.reward_claims
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rewards r
      WHERE r.id = reward_claims.reward_id
        AND app_tenant_org_member(r.organization_id)
    )
  );

-- Redemptions and paid POS bills are financial records written only by the
-- POS checkout (a verified merchant API key, system context). The customer and
-- the merchant's members may READ them; nobody writes them from a user session.
DROP POLICY IF EXISTS reward_redemptions_access ON public.reward_redemptions;
DROP POLICY IF EXISTS reward_redemptions_select ON public.reward_redemptions;
CREATE POLICY reward_redemptions_select ON public.reward_redemptions
  FOR SELECT
  USING (
    app_owns(user_id)
    OR app_tenant_org_member(organization_id)
    OR app_rls_bypass()
  );
DROP POLICY IF EXISTS reward_redemptions_system_write ON public.reward_redemptions;
CREATE POLICY reward_redemptions_system_write ON public.reward_redemptions
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS reward_sales_access ON public.reward_sales;
DROP POLICY IF EXISTS reward_sales_select ON public.reward_sales;
CREATE POLICY reward_sales_select ON public.reward_sales
  FOR SELECT
  USING (
    app_owns(user_id)
    OR app_tenant_org_member(organization_id)
    OR app_rls_bypass()
  );
DROP POLICY IF EXISTS reward_sales_system_write ON public.reward_sales;
CREATE POLICY reward_sales_system_write ON public.reward_sales
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS reward_referrals_parties ON public.reward_referrals;
CREATE POLICY reward_referrals_parties ON public.reward_referrals
  USING (
    app_owns(referrer_user_id)
    OR app_owns(referee_user_id)
    OR app_rls_bypass()
  )
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS reward_otp_own ON public.reward_otp_challenges;
CREATE POLICY reward_otp_own ON public.reward_otp_challenges
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_legal_own ON public.reward_legal_acceptances;
CREATE POLICY reward_legal_own ON public.reward_legal_acceptances
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_notifications_own ON public.reward_notifications;
CREATE POLICY reward_notifications_own ON public.reward_notifications
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_audit_insert ON public.reward_audit_logs;
CREATE POLICY reward_audit_insert ON public.reward_audit_logs
  FOR INSERT
  WITH CHECK (app_rls_bypass() OR (organization_id IS NOT NULL AND app_tenant_org_member(organization_id)));

DROP POLICY IF EXISTS reward_audit_select ON public.reward_audit_logs;
CREATE POLICY reward_audit_select ON public.reward_audit_logs
  FOR SELECT
  USING (
    app_rls_bypass()
    OR (organization_id IS NOT NULL AND app_tenant_org_member(organization_id))
  );

-- Internal infrastructure tables — bypass-only (never user-scoped reads/writes).
DROP POLICY IF EXISTS outbox_events_bypass ON public.outbox_events;
CREATE POLICY outbox_events_bypass ON public.outbox_events
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Transactional outbox (docs/adr/015-transactional-outbox-and-inbox.md): an
-- event row is written in the SAME transaction as the domain change it
-- describes, and that transaction runs under the caller's (usually
-- user/tenant-scoped, non-bypass) RLS session. This policy lets any app
-- session APPEND a fresh PENDING row — nothing more: no SELECT (so no
-- INSERT … RETURNING; the producer assigns the id), no UPDATE/DELETE, and no
-- pre-published / pre-failed / pre-attempted rows. Reading and advancing rows
-- stays bypass-only (the dispatcher runs as the `outbox.publish` system op).
DROP POLICY IF EXISTS outbox_events_append ON public.outbox_events;
CREATE POLICY outbox_events_append ON public.outbox_events
  FOR INSERT
  WITH CHECK (status = 'PENDING' AND attempts = 0 AND published_at IS NULL AND last_error IS NULL);

DROP POLICY IF EXISTS analytics_events_bypass ON public.analytics_events;
CREATE POLICY analytics_events_bypass ON public.analytics_events
  TO app_runtime
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Consumer inbox ledger + parked poison messages. Never user-visible. The
-- bypass policies above/below apply to `app_runtime` only (operator tooling);
-- apps/analytics-consumer writes as its own least-privilege role, whose grants
-- and policies live in prisma/rls/90-analytics-consumer.sql.
DROP POLICY IF EXISTS inbox_processed_events_bypass ON public.inbox_processed_events;
CREATE POLICY inbox_processed_events_bypass ON public.inbox_processed_events
  TO app_runtime
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS inbox_dead_letters_bypass ON public.inbox_dead_letters;
CREATE POLICY inbox_dead_letters_bypass ON public.inbox_dead_letters
  TO app_runtime
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Global HTTP audit log (docs/adr/025-global-http-audit-log.md): append-only.
-- Rows are INSERTed under a named system operation — `audit.http_request.record`
-- (AuditLogInterceptor / GlobalExceptionFilter) or the operation of a handler's
-- own system transaction (AuditTrailService.recordInTransaction). Reading is
-- bypass-only; UPDATE/DELETE are revoked from app_runtime in
-- 99-app-runtime-grants.sql (it re-grants table privileges, so the revoke must
-- run after it).
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT
  USING (app_rls_bypass());

DROP POLICY IF EXISTS platform_resource_idempotency_bypass ON public.platform_resource_idempotency_records;
CREATE POLICY platform_resource_idempotency_bypass ON public.platform_resource_idempotency_records
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
-- ── Organization multi-tenancy (docs/technical/authorization/tenancy-and-rls.md) ───────────────────
-- ReBAC helpers: prisma/rls/01-acl-location-access.sql (applied before this bundle).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations',
    'organization_slug_history',
    'organization_locations',
    'stores',
    'store_memberships',
    'organization_memberships',
    'organization_membership_location_scopes',
    'organization_merchant_profiles',
    'organization_invitations',
    'organization_invitation_location_scopes',
    'organization_access_requests',
    'organization_lifecycle_events',
    'tenant_placements',
    'organization_entitlements',
    'organization_quotas',
    'authorization_policy_drafts',
    'authorization_policy_versions',
    'support_access_grants',
    'tenant_encryption_keys',
    'organization_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS organizations_member ON public.organizations;
CREATE POLICY organizations_member ON public.organizations
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_organization_member_of(id)
    OR (
      app_current_user_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = organizations.id
          AND m.user_id = app_current_user_id()
          AND m.status = 'ACTIVE'
          AND m.is_deleted = false
      )
    )
  );

DROP POLICY IF EXISTS organizations_write ON public.organizations;
CREATE POLICY organizations_write ON public.organizations
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS organization_tenant_tables ON public.organization_locations;
DROP POLICY IF EXISTS organization_locations_member ON public.organization_locations;
CREATE POLICY organization_locations_member ON public.organization_locations
  USING (
    app_rls_bypass()
    OR app_tenant_organization_member_of(organization_id)
    OR app_organization_member_of(organization_id)
  )
  WITH CHECK (
    app_rls_bypass()
    OR app_tenant_organization_member_of(organization_id)
    OR app_organization_member_of(organization_id)
  );

-- Stores: organization members read their org's stores; store members read their store.
-- A store is the 1:1 mirror of an organization location, written in the SAME
-- transaction as every location write (syncStoreForLocation). Location writes
-- run in the member's tenant transaction (store request / resubmit) or a system
-- operation (admin review, close), so the mirror is writable under exactly the
-- tenant condition `organization_locations_member` accepts — and only for a row
-- that mirrors one of that tenant's own locations. Never hard-deleted (DELETE
-- stays bypass-only).
DROP POLICY IF EXISTS stores_member ON public.stores;
DROP POLICY IF EXISTS stores_select ON public.stores;
DROP POLICY IF EXISTS stores_mirror_insert ON public.stores;
DROP POLICY IF EXISTS stores_mirror_update ON public.stores;
DROP POLICY IF EXISTS stores_delete ON public.stores;
CREATE POLICY stores_select ON public.stores
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_tenant_organization_member_of(organization_id)
    OR app_organization_member_of(organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.store_memberships sm
      WHERE sm.store_id = stores.id
        AND sm.user_id = app_current_user_id()
        AND sm.status = 'ACTIVE'
        AND sm.is_deleted = false
    )
  );
CREATE POLICY stores_mirror_insert ON public.stores
  FOR INSERT
  WITH CHECK (
    app_rls_bypass()
    OR (
      app_tenant_organization_member_of(organization_id)
      AND EXISTS (
        SELECT 1
        FROM public.organization_locations loc
        WHERE loc.id = stores.location_id
          AND loc.organization_id = stores.organization_id
      )
    )
  );
CREATE POLICY stores_mirror_update ON public.stores
  FOR UPDATE
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
  WITH CHECK (
    app_rls_bypass()
    OR (
      app_tenant_organization_member_of(organization_id)
      AND EXISTS (
        SELECT 1
        FROM public.organization_locations loc
        WHERE loc.id = stores.location_id
          AND loc.organization_id = stores.organization_id
      )
    )
  );
CREATE POLICY stores_delete ON public.stores
  FOR DELETE
  USING (app_rls_bypass());

-- Store memberships: a user sees their own rows; organization members see the org's rows.
DROP POLICY IF EXISTS store_memberships_member ON public.store_memberships;
CREATE POLICY store_memberships_member ON public.store_memberships
  USING (
    app_rls_bypass()
    OR user_id = app_current_user_id()
    OR app_tenant_organization_member_of(organization_id)
  )
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS organization_memberships_member ON public.organization_memberships;
CREATE POLICY organization_memberships_member ON public.organization_memberships
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
  WITH CHECK (app_rls_bypass() OR app_tenant_organization_member_of(organization_id));

DROP POLICY IF EXISTS organization_audit_logs_member ON public.organization_audit_logs;
CREATE POLICY organization_audit_logs_member ON public.organization_audit_logs
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
  WITH CHECK (app_rls_bypass() OR app_tenant_organization_member_of(organization_id));

DROP POLICY IF EXISTS organization_access_requests_policy ON public.organization_access_requests;
DROP POLICY IF EXISTS organization_access_requests_select ON public.organization_access_requests;
DROP POLICY IF EXISTS organization_access_requests_insert ON public.organization_access_requests;
CREATE POLICY organization_access_requests_select ON public.organization_access_requests
  FOR SELECT
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id) OR user_id = app_current_user_id());
CREATE POLICY organization_access_requests_insert ON public.organization_access_requests
  FOR INSERT
  WITH CHECK (app_rls_bypass() OR user_id = app_current_user_id());
-- Reviewing (the PENDING → APPROVED/REJECTED compare-and-set) runs only as the
-- `organization.access_request.review` system operation, after the reviewer's
-- manage-team check. Without an UPDATE policy forced RLS matches no row, so the
-- claim updated nothing and every review reported "already reviewed" (409).
DROP POLICY IF EXISTS organization_access_requests_review ON public.organization_access_requests;
CREATE POLICY organization_access_requests_review ON public.organization_access_requests
  FOR UPDATE
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS organization_merchant_profiles_member ON public.organization_merchant_profiles;
CREATE POLICY organization_merchant_profiles_member ON public.organization_merchant_profiles
  USING (app_rls_bypass() OR app_tenant_org_member(organization_id))
  WITH CHECK (app_rls_bypass() OR app_tenant_org_member(organization_id));

-- Remaining organization tables: tenant member read, bypass write for sagas.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organization_slug_history',
    'organization_membership_location_scopes',
    'organization_invitations',
    'organization_invitation_location_scopes',
    'organization_lifecycle_events',
    'tenant_placements',
    'organization_entitlements',
    'organization_quotas',
    'authorization_policy_drafts',
    'authorization_policy_versions',
    'support_access_grants',
    'tenant_encryption_keys'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_member ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_member ON public.%I USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id)) WITH CHECK (app_rls_bypass())',
      tbl, tbl
    );
  END LOOP;
END $$;

ALTER TABLE public.authorization_policy_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_policy_simulations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authorization_policy_simulations_bypass ON public.authorization_policy_simulations;
CREATE POLICY authorization_policy_simulations_bypass ON public.authorization_policy_simulations
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- RLS for SampleCategory (admin-only)
ALTER TABLE sample_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sample_category_select ON sample_category;
DROP POLICY IF EXISTS sample_category_insert ON sample_category;
DROP POLICY IF EXISTS sample_category_update ON sample_category;
DROP POLICY IF EXISTS sample_category_delete ON sample_category;
CREATE POLICY sample_category_select ON sample_category FOR SELECT USING (app_rls_bypass());
CREATE POLICY sample_category_insert ON sample_category FOR INSERT WITH CHECK (app_rls_bypass());
CREATE POLICY sample_category_update ON sample_category FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY sample_category_delete ON sample_category FOR DELETE USING (app_rls_bypass());
-- RLS for Product (admin-only)
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_select ON product;
DROP POLICY IF EXISTS product_insert ON product;
DROP POLICY IF EXISTS product_update ON product;
DROP POLICY IF EXISTS product_delete ON product;
CREATE POLICY product_select ON product FOR SELECT USING (app_rls_bypass());
CREATE POLICY product_insert ON product FOR INSERT WITH CHECK (app_rls_bypass());
CREATE POLICY product_update ON product FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY product_delete ON product FOR DELETE USING (app_rls_bypass());
