-- ============================================================================
-- Row-Level Security — main bundle (idempotent)
-- ============================================================================
-- Prisma migrations do NOT emit RLS. Do not append this SQL to migration.sql
-- (squashed migrations would drop it). Security is applied automatically by:
--
--   pnpm db:migrate | db:deploy | db:reset | db:push
--
-- via `scripts/apply-rls.ts` (runs this file, then prisma/rls/*.sql fragments).
-- See prisma/rls/README.md and docs/rbac-acl-rls-architecture.md.
-- ============================================================================

-- ── 1. app_runtime role ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT app_runtime TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- ── 2. RLS helper functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'false')::boolean;
$$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_owns(owner_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass() OR (app_current_user_id() IS NOT NULL AND app_current_user_id() = owner_id);
$$;

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
    'outbox_events',
    'analytics_events',
    'platform_resource_audit_logs',
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

DROP POLICY IF EXISTS merchant_role_capabilities_read ON public.merchant_role_capabilities;
CREATE POLICY merchant_role_capabilities_read ON public.merchant_role_capabilities
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS merchant_role_capabilities_write ON public.merchant_role_capabilities;
CREATE POLICY merchant_role_capabilities_write ON public.merchant_role_capabilities
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Append-mostly tables (insert public, select/update/delete via bypass) ──

DROP POLICY IF EXISTS logs_bypass ON public.logs;
CREATE POLICY logs_insert ON public.logs FOR INSERT WITH CHECK (true);
CREATE POLICY logs_select ON public.logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY logs_update ON public.logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY logs_delete ON public.logs FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS email_logs_bypass ON public.email_logs;
CREATE POLICY email_logs_insert ON public.email_logs FOR INSERT WITH CHECK (true);
CREATE POLICY email_logs_select ON public.email_logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY email_logs_update ON public.email_logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY email_logs_delete ON public.email_logs FOR DELETE USING (app_rls_bypass());

-- ── Audit tables (bypass-only) ─────────────────────────────────────────────

DROP POLICY IF EXISTS permission_audit_logs_bypass ON public.permission_audit_logs;
CREATE POLICY permission_audit_logs_bypass ON public.permission_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_bypass ON public.impersonation_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Impersonation audit is append-only for app_runtime (not representable in PSL).
REVOKE UPDATE, DELETE ON TABLE public.impersonation_audit_logs FROM app_runtime;

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

-- ── Geo tables (reference data: public read, admin write) ────────────────

ALTER TABLE IF EXISTS public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regions_read ON public.regions;
CREATE POLICY regions_read ON public.regions
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS regions_write ON public.regions;
CREATE POLICY regions_write ON public.regions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE IF EXISTS public.subregions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subregions_read ON public.subregions;
CREATE POLICY subregions_read ON public.subregions
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS subregions_write ON public.subregions;
CREATE POLICY subregions_write ON public.subregions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE IF EXISTS public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS countries_read ON public.countries;
CREATE POLICY countries_read ON public.countries
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS countries_write ON public.countries;
CREATE POLICY countries_write ON public.countries
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE IF EXISTS public.states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS states_read ON public.states;
CREATE POLICY states_read ON public.states
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS states_write ON public.states;
CREATE POLICY states_write ON public.states
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

ALTER TABLE IF EXISTS public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cities_read ON public.cities;
CREATE POLICY cities_read ON public.cities
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS cities_write ON public.cities;
CREATE POLICY cities_write ON public.cities
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Rewards platform (organization-scoped — docs/rewards-platform-prd.md) ─

-- Membership helper for RewardHub tables — SECURITY DEFINER to avoid RLS recursion.
CREATE OR REPLACE FUNCTION app_organization_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_rls_bypass() OR (
    app_current_user_id() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = org_id
        AND m.user_id = app_current_user_id()
        AND m.status = 'ACTIVE'
        AND m.is_deleted = false
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_runtime;

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
    'reward_referrals',
    'reward_otp_challenges',
    'reward_legal_acceptances',
    'reward_notifications',
    'reward_audit_logs',
    'reward_redemption_idempotency_records',
    'organization_kyb_documents',
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

DROP POLICY IF EXISTS organization_api_keys_org ON public.organization_api_keys;
CREATE POLICY organization_api_keys_org ON public.organization_api_keys
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS organization_terminals_org ON public.organization_terminals;
CREATE POLICY organization_terminals_org ON public.organization_terminals
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS organization_kyb_documents_org ON public.organization_kyb_documents;
CREATE POLICY organization_kyb_documents_org ON public.organization_kyb_documents
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS stored_files_owner ON public.stored_files;
CREATE POLICY stored_files_owner ON public.stored_files
  USING (app_owns(uploaded_by_id) OR (organization_id IS NOT NULL AND app_organization_member_of(organization_id)) OR app_rls_bypass())
  WITH CHECK (app_owns(uploaded_by_id) OR (organization_id IS NOT NULL AND app_organization_member_of(organization_id)) OR app_rls_bypass());

DROP POLICY IF EXISTS file_variants_file ON public.file_variants;
CREATE POLICY file_variants_file ON public.file_variants
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (app_owns(sf.uploaded_by_id) OR (sf.organization_id IS NOT NULL AND app_organization_member_of(sf.organization_id)))
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (app_owns(sf.uploaded_by_id) OR (sf.organization_id IS NOT NULL AND app_organization_member_of(sf.organization_id)))
    )
  );

DROP POLICY IF EXISTS product_images_catalog ON public.product_images;
CREATE POLICY product_images_catalog ON public.product_images
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS organization_assets_org ON public.organization_assets;
CREATE POLICY organization_assets_org ON public.organization_assets
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS user_avatars_owner ON public.user_avatars;
CREATE POLICY user_avatars_owner ON public.user_avatars
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS organization_kyb_files_org ON public.organization_kyb_files;
CREATE POLICY organization_kyb_files_org ON public.organization_kyb_files
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

-- Published consumer rewards are marketplace-readable; org members see all org rewards.
DROP POLICY IF EXISTS rewards_read ON public.rewards;
CREATE POLICY rewards_read ON public.rewards
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_organization_member_of(organization_id)
    OR (
      is_deleted = false
      AND reward_kind = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS rewards_write ON public.rewards;
CREATE POLICY rewards_write ON public.rewards
  FOR INSERT
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_update ON public.rewards;
CREATE POLICY rewards_update ON public.rewards
  FOR UPDATE
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_delete ON public.rewards;
CREATE POLICY rewards_delete ON public.rewards
  FOR DELETE
  USING (app_organization_member_of(organization_id) OR app_rls_bypass());

ALTER TABLE public.reward_location_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_location_scopes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_location_scopes_read ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_read ON public.reward_location_scopes
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_organization_member_of(organization_id)
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
  USING (app_organization_member_of(organization_id) OR app_rls_bypass())
  WITH CHECK (app_organization_member_of(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_claims_own ON public.reward_claims;
CREATE POLICY reward_claims_own ON public.reward_claims
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_redemptions_access ON public.reward_redemptions;
CREATE POLICY reward_redemptions_access ON public.reward_redemptions
  USING (
    app_owns(user_id)
    OR app_organization_member_of(organization_id)
    OR app_rls_bypass()
  )
  WITH CHECK (
    app_owns(user_id)
    OR app_organization_member_of(organization_id)
    OR app_rls_bypass()
  );

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
  WITH CHECK (app_rls_bypass() OR (organization_id IS NOT NULL AND app_organization_member_of(organization_id)));

DROP POLICY IF EXISTS reward_audit_select ON public.reward_audit_logs;
CREATE POLICY reward_audit_select ON public.reward_audit_logs
  FOR SELECT
  USING (
    app_rls_bypass()
    OR (organization_id IS NOT NULL AND app_organization_member_of(organization_id))
  );

DROP POLICY IF EXISTS reward_idempotency_bypass ON public.reward_redemption_idempotency_records;
CREATE POLICY reward_idempotency_bypass ON public.reward_redemption_idempotency_records
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Internal infrastructure tables — bypass-only (never user-scoped reads/writes).
DROP POLICY IF EXISTS outbox_events_bypass ON public.outbox_events;
CREATE POLICY outbox_events_bypass ON public.outbox_events
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS analytics_events_bypass ON public.analytics_events;
CREATE POLICY analytics_events_bypass ON public.analytics_events
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS platform_resource_audit_logs_bypass ON public.platform_resource_audit_logs;
CREATE POLICY platform_resource_audit_logs_bypass ON public.platform_resource_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS platform_resource_idempotency_bypass ON public.platform_resource_idempotency_records;
CREATE POLICY platform_resource_idempotency_bypass ON public.platform_resource_idempotency_records
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
-- ── Organization multi-tenancy (docs/multi-tenancy.md) ───────────────────

-- Tenant-scoped membership check (requires active tenant context).
CREATE OR REPLACE FUNCTION app_tenant_organization_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_rls_bypass()
    OR (
      app_current_user_id() IS NOT NULL
      AND app_current_organization_id() IS NOT NULL
      AND app_current_organization_id() = org_id
      AND EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.organization_id = org_id
          AND m.user_id = app_current_user_id()
          AND m.status = 'ACTIVE'
          AND m.is_deleted = false
      )
    );
$$;

GRANT EXECUTE ON FUNCTION app_tenant_organization_member_of(text) TO app_runtime;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations',
    'organization_slug_history',
    'organization_locations',
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

DROP POLICY IF EXISTS organization_memberships_member ON public.organization_memberships;
CREATE POLICY organization_memberships_member ON public.organization_memberships
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
  WITH CHECK (app_rls_bypass() OR app_tenant_organization_member_of(organization_id));

DROP POLICY IF EXISTS organization_audit_logs_member ON public.organization_audit_logs;
CREATE POLICY organization_audit_logs_member ON public.organization_audit_logs
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id))
  WITH CHECK (app_rls_bypass() OR app_tenant_organization_member_of(organization_id));

DROP POLICY IF EXISTS organization_access_requests_policy ON public.organization_access_requests;
CREATE POLICY organization_access_requests_select ON public.organization_access_requests
  FOR SELECT
  USING (app_rls_bypass() OR app_tenant_organization_member_of(organization_id) OR user_id = app_current_user_id());
CREATE POLICY organization_access_requests_insert ON public.organization_access_requests
  FOR INSERT
  WITH CHECK (app_rls_bypass() OR user_id = app_current_user_id());

DROP POLICY IF EXISTS organization_merchant_profiles_member ON public.organization_merchant_profiles;
CREATE POLICY organization_merchant_profiles_member ON public.organization_merchant_profiles
  USING (app_rls_bypass() OR app_organization_member_of(organization_id))
  WITH CHECK (app_rls_bypass() OR app_organization_member_of(organization_id));

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

-- @app-generated:begin SampleCategory
-- Generated RLS for SampleCategory (admin-only)
ALTER TABLE sample_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sample_category_select ON sample_category;
DROP POLICY IF EXISTS sample_category_insert ON sample_category;
DROP POLICY IF EXISTS sample_category_update ON sample_category;
DROP POLICY IF EXISTS sample_category_delete ON sample_category;
CREATE POLICY sample_category_select ON sample_category FOR SELECT USING (app_rls_bypass());
CREATE POLICY sample_category_insert ON sample_category FOR INSERT WITH CHECK (app_rls_bypass());
CREATE POLICY sample_category_update ON sample_category FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY sample_category_delete ON sample_category FOR DELETE USING (app_rls_bypass());
-- @app-generated:end SampleCategory
-- @app-generated:begin Product
-- Generated RLS for Product (admin-only)
ALTER TABLE product ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_select ON product;
DROP POLICY IF EXISTS product_insert ON product;
DROP POLICY IF EXISTS product_update ON product;
DROP POLICY IF EXISTS product_delete ON product;
CREATE POLICY product_select ON product FOR SELECT USING (app_rls_bypass());
CREATE POLICY product_insert ON product FOR INSERT WITH CHECK (app_rls_bypass());
CREATE POLICY product_update ON product FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY product_delete ON product FOR DELETE USING (app_rls_bypass());
-- @app-generated:end Product