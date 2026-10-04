-- ============================================================================
-- 40 — the merchant API key as a database principal (applied after rls.sql)
-- ============================================================================
-- A request authenticated by a merchant API key (POS till or back-office
-- integration) runs as the `api_key` RLS context (apps/api/src/prisma/
-- rls-context.ts): no user, no bypass, and these session variables, set only
-- by the server AFTER the key lookup verified the key:
--
--   app.current_organization_id     the key's organization
--   app.current_api_key_id          the key
--   app.current_api_key_location_id the key's store ('' = organization-wide key)
--
-- The policies below are ADDITIONAL permissive policies: they grant that
-- principal exactly the rows of its own organization the POS routes and the
-- organization API read or write — and, for tables whose rows belong to ONE
-- store (redemptions, sales, terminals), only its store's rows when the key is
-- store-scoped. Tables without a store column (rewards, claims, referrals) are
-- scoped to the organization; their store availability is enforced by the API
-- service layer (MerchantContextService). A key never deletes anything here.
-- User / anonymous sessions are unaffected: app_current_api_key_id() is NULL
-- for them, so none of these policies matches.
-- Idempotent (CREATE OR REPLACE / DROP POLICY IF EXISTS) — safe to re-run.
-- ============================================================================

-- ── session helpers

CREATE OR REPLACE FUNCTION app_current_api_key_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_api_key_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_current_api_key_location_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_api_key_location_id', true), '');
$$;

-- The session is an API key acting for `org_id`.
CREATE OR REPLACE FUNCTION app_api_key_org_access(org_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND app_current_organization_id() IS NOT NULL
    AND org_id = app_current_organization_id();
$$;

-- …and, for a store-scoped key, the row belongs to the key's store. A row with
-- no store (NULL) is visible only to an organization-wide key.
CREATE OR REPLACE FUNCTION app_api_key_store_access(org_id text, loc_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_api_key_org_access(org_id)
    AND (app_current_api_key_location_id() IS NULL OR loc_id = app_current_api_key_location_id());
$$;

-- The reward belongs to the key's organization (claims / referrals inherit it).
CREATE OR REPLACE FUNCTION app_api_key_reward_access(reward_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.rewards r WHERE r.id = reward_id AND app_api_key_org_access(r.organization_id));
$$;

GRANT EXECUTE ON FUNCTION app_current_api_key_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_api_key_location_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_org_access(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_store_access(text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_reward_access(text) TO app_runtime;

-- ── organization reference rows the reward responses embed (read only)

DROP POLICY IF EXISTS organizations_api_key_read ON public.organizations;
CREATE POLICY organizations_api_key_read ON public.organizations
  FOR SELECT TO app_runtime USING (app_api_key_org_access(id));

DROP POLICY IF EXISTS organization_locations_api_key_read ON public.organization_locations;
CREATE POLICY organization_locations_api_key_read ON public.organization_locations
  FOR SELECT TO app_runtime USING (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS organization_assets_api_key_read ON public.organization_assets;
CREATE POLICY organization_assets_api_key_read ON public.organization_assets
  FOR SELECT TO app_runtime USING (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS stored_files_api_key_read ON public.stored_files;
CREATE POLICY stored_files_api_key_read ON public.stored_files
  FOR SELECT TO app_runtime USING (organization_id IS NOT NULL AND app_api_key_org_access(organization_id));

-- ── the key's own row (last-used stamp, POS code-guess lockout counters)

DROP POLICY IF EXISTS organization_api_keys_api_key_self_read ON public.organization_api_keys;
CREATE POLICY organization_api_keys_api_key_self_read ON public.organization_api_keys
  FOR SELECT TO app_runtime USING (id = app_current_api_key_id() AND app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS organization_api_keys_api_key_self_update ON public.organization_api_keys;
CREATE POLICY organization_api_keys_api_key_self_update ON public.organization_api_keys
  FOR UPDATE TO app_runtime
  USING (id = app_current_api_key_id() AND app_api_key_org_access(organization_id))
  WITH CHECK (id = app_current_api_key_id() AND app_api_key_org_access(organization_id));

-- ── terminals of the key's store (last-seen stamp)

DROP POLICY IF EXISTS organization_terminals_api_key_read ON public.organization_terminals;
CREATE POLICY organization_terminals_api_key_read ON public.organization_terminals
  FOR SELECT TO app_runtime USING (app_api_key_store_access(organization_id, location_id));

DROP POLICY IF EXISTS organization_terminals_api_key_update ON public.organization_terminals;
CREATE POLICY organization_terminals_api_key_update ON public.organization_terminals
  FOR UPDATE TO app_runtime
  USING (app_api_key_store_access(organization_id, location_id))
  WITH CHECK (app_api_key_store_access(organization_id, location_id));

-- ── rewards (organization API CRUD; checkout updates stock and referral pools)

DROP POLICY IF EXISTS rewards_api_key_read ON public.rewards;
CREATE POLICY rewards_api_key_read ON public.rewards
  FOR SELECT TO app_runtime USING (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS rewards_api_key_insert ON public.rewards;
CREATE POLICY rewards_api_key_insert ON public.rewards
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS rewards_api_key_update ON public.rewards;
CREATE POLICY rewards_api_key_update ON public.rewards
  FOR UPDATE TO app_runtime
  USING (app_api_key_org_access(organization_id))
  WITH CHECK (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS reward_location_scopes_api_key_read ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_api_key_read ON public.reward_location_scopes
  FOR SELECT TO app_runtime USING (app_api_key_org_access(organization_id));

DROP POLICY IF EXISTS reward_location_scopes_api_key_insert ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_api_key_insert ON public.reward_location_scopes
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access(organization_id));

-- ── claims of the organization's rewards (POS lookup, PENDING → REDEEMED, referrer credit)

DROP POLICY IF EXISTS reward_claims_api_key_read ON public.reward_claims;
CREATE POLICY reward_claims_api_key_read ON public.reward_claims
  FOR SELECT TO app_runtime USING (app_api_key_reward_access(reward_id));

DROP POLICY IF EXISTS reward_claims_api_key_insert ON public.reward_claims;
CREATE POLICY reward_claims_api_key_insert ON public.reward_claims
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_reward_access(reward_id));

DROP POLICY IF EXISTS reward_claims_api_key_update ON public.reward_claims;
CREATE POLICY reward_claims_api_key_update ON public.reward_claims
  FOR UPDATE TO app_runtime
  USING (app_api_key_reward_access(reward_id))
  WITH CHECK (app_api_key_reward_access(reward_id));

DROP POLICY IF EXISTS reward_referrals_api_key_read ON public.reward_referrals;
CREATE POLICY reward_referrals_api_key_read ON public.reward_referrals
  FOR SELECT TO app_runtime USING (app_api_key_reward_access(reward_id));

DROP POLICY IF EXISTS reward_referrals_api_key_update ON public.reward_referrals;
CREATE POLICY reward_referrals_api_key_update ON public.reward_referrals
  FOR UPDATE TO app_runtime
  USING (app_api_key_reward_access(reward_id))
  WITH CHECK (app_api_key_reward_access(reward_id));

-- The in-app "referrer reward credited" notice written inside a checkout: only
-- to a user who referred someone to one of this organization's rewards.
DROP POLICY IF EXISTS reward_notifications_api_key_insert ON public.reward_notifications;
CREATE POLICY reward_notifications_api_key_insert ON public.reward_notifications
  FOR INSERT TO app_runtime
  WITH CHECK (
    app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.reward_referrals rr
      WHERE rr.referrer_user_id = reward_notifications.user_id
        AND app_api_key_reward_access(rr.reward_id)
    )
  );

-- ── financial rows of the key's store (checkout writes, organization API reads)

DROP POLICY IF EXISTS reward_redemptions_api_key_read ON public.reward_redemptions;
CREATE POLICY reward_redemptions_api_key_read ON public.reward_redemptions
  FOR SELECT TO app_runtime USING (app_api_key_store_access(organization_id, location_id));

DROP POLICY IF EXISTS reward_redemptions_api_key_insert ON public.reward_redemptions;
CREATE POLICY reward_redemptions_api_key_insert ON public.reward_redemptions
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_store_access(organization_id, location_id));

DROP POLICY IF EXISTS reward_sales_api_key_read ON public.reward_sales;
CREATE POLICY reward_sales_api_key_read ON public.reward_sales
  FOR SELECT TO app_runtime USING (app_api_key_store_access(organization_id, location_id));

DROP POLICY IF EXISTS reward_sales_api_key_insert ON public.reward_sales;
CREATE POLICY reward_sales_api_key_insert ON public.reward_sales
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_store_access(organization_id, location_id));

-- ── audit trail of the key's organization (append only)

DROP POLICY IF EXISTS reward_audit_logs_api_key_insert ON public.reward_audit_logs;
CREATE POLICY reward_audit_logs_api_key_insert ON public.reward_audit_logs
  FOR INSERT TO app_runtime WITH CHECK (organization_id IS NOT NULL AND app_api_key_org_access(organization_id));
