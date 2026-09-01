-- ============================================================================
-- Row-Level Security setup — standalone, idempotent
-- ============================================================================
-- This file is the CANONICAL source for RLS in the project.  Prisma does not
-- support RLS natively, so `prisma migrate dev` and `prisma db push` never
-- emit these statements.  Run this AFTER every migration or push:
--
--   pnpm --filter @workspace/api db:rls
--
-- The file is idempotent: every statement uses DROP IF EXISTS / CREATE OR
-- REPLACE so it can be re-applied safely at any time.
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
    'permission_audit_logs',
    'menu_items',
    'menu_item_permissions',
    'menu_item_roles',
    'password_reset_tokens',
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
    'email_logs'
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

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_items_read ON public.menu_items;
CREATE POLICY menu_items_read ON public.menu_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_items_write ON public.menu_items;
CREATE POLICY menu_items_write ON public.menu_items
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_item_permissions_read ON public.menu_item_permissions;
CREATE POLICY menu_item_permissions_read ON public.menu_item_permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_item_permissions_write ON public.menu_item_permissions;
CREATE POLICY menu_item_permissions_write ON public.menu_item_permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_item_roles_read ON public.menu_item_roles;
CREATE POLICY menu_item_roles_read ON public.menu_item_roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_item_roles_write ON public.menu_item_roles;
CREATE POLICY menu_item_roles_write ON public.menu_item_roles
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

-- ── Rewards platform (Phase 1 — docs/rewards-platform-prd.md) ─────────────

-- Membership helper — SECURITY DEFINER so the merchant_members lookup does not
-- re-enter RLS (merchant_members policies also call this function → stack overflow).
CREATE OR REPLACE FUNCTION app_merchant_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_rls_bypass() OR (
    app_current_user_id() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.merchant_members m
      WHERE m.merchant_org_id = org_id
        AND m.user_id = app_current_user_id()
        AND m.is_deleted = false
    )
  );
$$;

GRANT EXECUTE ON FUNCTION app_merchant_member_of(text) TO app_runtime;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'merchant_orgs',
    'merchant_members',
    'merchant_api_keys',
    'merchant_terminals',
    'merchant_invites',
    'rewards',
    'reward_claims',
    'reward_redemptions',
    'reward_referrals',
    'reward_otp_challenges',
    'reward_legal_acceptances',
    'reward_notifications',
    'reward_audit_logs',
    'reward_redemption_idempotency_records'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Merchant orgs: members read/write their org; bypass for admin jobs.
DROP POLICY IF EXISTS merchant_orgs_member ON public.merchant_orgs;
CREATE POLICY merchant_orgs_member ON public.merchant_orgs
  USING (app_merchant_member_of(id) OR app_rls_bypass())
  WITH CHECK (app_merchant_member_of(id) OR app_rls_bypass());

DROP POLICY IF EXISTS merchant_members_org ON public.merchant_members;
CREATE POLICY merchant_members_org ON public.merchant_members
  USING (app_merchant_member_of(merchant_org_id) OR app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

DROP POLICY IF EXISTS merchant_api_keys_org ON public.merchant_api_keys;
CREATE POLICY merchant_api_keys_org ON public.merchant_api_keys
  USING (app_merchant_member_of(merchant_org_id) OR app_rls_bypass())
  WITH CHECK (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

DROP POLICY IF EXISTS merchant_terminals_org ON public.merchant_terminals;
CREATE POLICY merchant_terminals_org ON public.merchant_terminals
  USING (app_merchant_member_of(merchant_org_id) OR app_rls_bypass())
  WITH CHECK (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

-- Invites: admin bypass; accept flow uses bypass for token lookup.
DROP POLICY IF EXISTS merchant_invites_bypass ON public.merchant_invites;
CREATE POLICY merchant_invites_bypass ON public.merchant_invites
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Published consumer rewards are marketplace-readable; org members see all org rewards.
-- Column grants: reward_value and terms_conditions inherit these row-level policies.
DROP POLICY IF EXISTS rewards_read ON public.rewards;
CREATE POLICY rewards_read ON public.rewards
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_merchant_member_of(merchant_org_id)
    OR (
      is_deleted = false
      AND reward_kind = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS rewards_write ON public.rewards;
CREATE POLICY rewards_write ON public.rewards
  FOR INSERT
  WITH CHECK (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_update ON public.rewards;
CREATE POLICY rewards_update ON public.rewards
  FOR UPDATE
  USING (app_merchant_member_of(merchant_org_id) OR app_rls_bypass())
  WITH CHECK (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_delete ON public.rewards;
CREATE POLICY rewards_delete ON public.rewards
  FOR DELETE
  USING (app_merchant_member_of(merchant_org_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_claims_own ON public.reward_claims;
CREATE POLICY reward_claims_own ON public.reward_claims
  USING (app_owns(user_id) OR app_rls_bypass())
  WITH CHECK (app_owns(user_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_redemptions_access ON public.reward_redemptions;
CREATE POLICY reward_redemptions_access ON public.reward_redemptions
  USING (
    app_owns(user_id)
    OR app_merchant_member_of(merchant_org_id)
    OR app_rls_bypass()
  )
  WITH CHECK (
    app_owns(user_id)
    OR app_merchant_member_of(merchant_org_id)
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

-- Validate scan audit: insert allowed under bypass (POS key auth) or org member.
DROP POLICY IF EXISTS reward_audit_insert ON public.reward_audit_logs;
CREATE POLICY reward_audit_insert ON public.reward_audit_logs
  FOR INSERT
  WITH CHECK (app_rls_bypass() OR (merchant_org_id IS NOT NULL AND app_merchant_member_of(merchant_org_id)));

DROP POLICY IF EXISTS reward_audit_select ON public.reward_audit_logs;
CREATE POLICY reward_audit_select ON public.reward_audit_logs
  FOR SELECT
  USING (
    app_rls_bypass()
    OR (merchant_org_id IS NOT NULL AND app_merchant_member_of(merchant_org_id))
  );

DROP POLICY IF EXISTS reward_idempotency_bypass ON public.reward_redemption_idempotency_records;
CREATE POLICY reward_idempotency_bypass ON public.reward_redemption_idempotency_records
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());
