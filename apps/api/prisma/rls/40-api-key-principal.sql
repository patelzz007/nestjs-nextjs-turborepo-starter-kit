-- ============================================================================
-- 40 — the merchant API key as a database principal (applied after rls.sql)
-- ============================================================================
-- A request authenticated by a merchant API key (POS till or back-office
-- integration) runs as the `api_key` RLS context (apps/api/src/prisma/
-- rls-context.ts): no user, no bypass, and these session variables, set only
-- by the server AFTER the key lookup verified the key:
--
--   app.current_tenant_id     the key's tenant
--   app.current_api_key_id          the key
--   app.current_api_key_location_id the key's store ('' = tenant-wide key)
--
-- The policies below are ADDITIONAL permissive policies: they grant that
-- principal exactly the rows of its own tenant the POS routes and the
-- tenant API read or write — and, for tables whose rows belong to ONE
-- store (redemptions, sales, terminals), only its store's rows when the key is
-- store-scoped. Tables without a store column (rewards, claims, referrals) are
-- scoped to the tenant; their store availability is enforced by the API
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
    AND app_current_tenant_id() IS NOT NULL
    AND org_id = app_current_tenant_id();
$$;

-- …and, for a store-scoped key, the row belongs to the key's store. A row with
-- no store (NULL) is visible only to a tenant-wide key.
CREATE OR REPLACE FUNCTION app_api_key_store_access(org_id text, loc_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_api_key_org_access(org_id)
    AND (app_current_api_key_location_id() IS NULL OR loc_id = app_current_api_key_location_id());
$$;

-- The reward belongs to the key's tenant (claims / referrals inherit it).
CREATE OR REPLACE FUNCTION app_api_key_reward_access("rewardId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public."Reward" r WHERE r.id = "rewardId" AND app_api_key_org_access(r."tenantId"));
$$;

-- The referee of a signup referral redeemed at the key's store (ADR 035): the
-- checkout transaction inserts the redemption first, so the stamp that follows
-- it in the same transaction sees the row. SECURITY DEFINER so the lookup does
-- not depend on the redemption table's own policies; it still checks the
-- key's tenant and store through the session helpers.
CREATE OR REPLACE FUNCTION app_api_key_signup_referee_access("refereeUserId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardRedemption" rr
      WHERE rr."userId" = "refereeUserId"
        AND rr."isDeleted" = false
        AND app_api_key_store_access(rr."tenantId", rr."locationId")
    );
$$;

GRANT EXECUTE ON FUNCTION app_current_api_key_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_api_key_location_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_org_access(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_store_access(text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_reward_access(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app_api_key_signup_referee_access(text) TO app_runtime;

-- ── tenant reference rows the reward responses embed (read only)

DROP POLICY IF EXISTS tenants_api_key_read ON public."Tenant";
CREATE POLICY tenants_api_key_read ON public."Tenant"
  FOR SELECT TO app_runtime USING (app_api_key_org_access(id));

DROP POLICY IF EXISTS locations_api_key_read ON public."Location";
CREATE POLICY locations_api_key_read ON public."Location"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_assets_api_key_read ON public."TenantAsset";
CREATE POLICY tenant_assets_api_key_read ON public."TenantAsset"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS stored_files_api_key_read ON public."StoredFile";
CREATE POLICY stored_files_api_key_read ON public."StoredFile"
  FOR SELECT TO app_runtime USING ("tenantId" IS NOT NULL AND app_api_key_org_access("tenantId"));

-- ── the key's own row (last-used stamp, POS code-guess lockout counters)

DROP POLICY IF EXISTS tenant_api_keys_api_key_self_read ON public."TenantApiKey";
CREATE POLICY tenant_api_keys_api_key_self_read ON public."TenantApiKey"
  FOR SELECT TO app_runtime USING (id = app_current_api_key_id() AND app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_api_keys_api_key_self_update ON public."TenantApiKey";
CREATE POLICY tenant_api_keys_api_key_self_update ON public."TenantApiKey"
  FOR UPDATE TO app_runtime
  USING (id = app_current_api_key_id() AND app_api_key_org_access("tenantId"))
  WITH CHECK (id = app_current_api_key_id() AND app_api_key_org_access("tenantId"));

-- ── terminals of the key's store (last-seen stamp)

DROP POLICY IF EXISTS tenant_terminals_api_key_read ON public."TenantTerminal";
CREATE POLICY tenant_terminals_api_key_read ON public."TenantTerminal"
  FOR SELECT TO app_runtime USING (app_api_key_store_access("tenantId", "locationId"));

DROP POLICY IF EXISTS tenant_terminals_api_key_update ON public."TenantTerminal";
CREATE POLICY tenant_terminals_api_key_update ON public."TenantTerminal"
  FOR UPDATE TO app_runtime
  USING (app_api_key_store_access("tenantId", "locationId"))
  WITH CHECK (app_api_key_store_access("tenantId", "locationId"));

-- ── rewards (tenant API CRUD; checkout updates stock and referral pools)

DROP POLICY IF EXISTS rewards_api_key_read ON public."Reward";
CREATE POLICY rewards_api_key_read ON public."Reward"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS rewards_api_key_insert ON public."Reward";
CREATE POLICY rewards_api_key_insert ON public."Reward"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS rewards_api_key_update ON public."Reward";
CREATE POLICY rewards_api_key_update ON public."Reward"
  FOR UPDATE TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_location_scopes_api_key_read ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_api_key_read ON public."RewardLocationScope"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_location_scopes_api_key_insert ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_api_key_insert ON public."RewardLocationScope"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_api_key_read ON public."RewardImage";
CREATE POLICY reward_images_api_key_read ON public."RewardImage"
  FOR SELECT TO app_runtime USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_api_key_insert ON public."RewardImage";
CREATE POLICY reward_images_api_key_insert ON public."RewardImage"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_api_key_update ON public."RewardImage";
CREATE POLICY reward_images_api_key_update ON public."RewardImage"
  FOR UPDATE TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

-- ── claims of the tenant's rewards (POS lookup, PENDING → REDEEMED, referrer credit)

DROP POLICY IF EXISTS reward_claims_api_key_read ON public."RewardClaim";
CREATE POLICY reward_claims_api_key_read ON public."RewardClaim"
  FOR SELECT TO app_runtime USING (app_api_key_reward_access("rewardId"));

DROP POLICY IF EXISTS reward_claims_api_key_insert ON public."RewardClaim";
CREATE POLICY reward_claims_api_key_insert ON public."RewardClaim"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_reward_access("rewardId"));

DROP POLICY IF EXISTS reward_claims_api_key_update ON public."RewardClaim";
CREATE POLICY reward_claims_api_key_update ON public."RewardClaim"
  FOR UPDATE TO app_runtime
  USING (app_api_key_reward_access("rewardId"))
  WITH CHECK (app_api_key_reward_access("rewardId"));

DROP POLICY IF EXISTS reward_referrals_api_key_read ON public."RewardReferral";
CREATE POLICY reward_referrals_api_key_read ON public."RewardReferral"
  FOR SELECT TO app_runtime USING (app_api_key_reward_access("rewardId"));

DROP POLICY IF EXISTS reward_referrals_api_key_update ON public."RewardReferral";
CREATE POLICY reward_referrals_api_key_update ON public."RewardReferral"
  FOR UPDATE TO app_runtime
  USING (app_api_key_reward_access("rewardId"))
  WITH CHECK (app_api_key_reward_access("rewardId"));

-- The checkout stamps the customer's signup referral successful (ADR 035): the
-- key reads and updates ONLY the signup referral of a customer it has just
-- redeemed for at its own store. It never inserts or deletes one, never sees
-- the referrer's other referees, and the success notification is written
-- after the commit under a system operation, not by the key.
DROP POLICY IF EXISTS signup_referrals_api_key_read ON public."SignupReferral";
CREATE POLICY signup_referrals_api_key_read ON public."SignupReferral"
  FOR SELECT TO app_runtime USING (app_api_key_signup_referee_access("refereeUserId"));

DROP POLICY IF EXISTS signup_referrals_api_key_update ON public."SignupReferral";
CREATE POLICY signup_referrals_api_key_update ON public."SignupReferral"
  FOR UPDATE TO app_runtime
  USING (app_api_key_signup_referee_access("refereeUserId"))
  WITH CHECK (app_api_key_signup_referee_access("refereeUserId"));

-- The in-app "referrer reward credited" notice written inside a checkout: only
-- to a user who referred someone to one of this tenant's rewards.
DROP POLICY IF EXISTS reward_notifications_api_key_insert ON public."RewardNotification";
CREATE POLICY reward_notifications_api_key_insert ON public."RewardNotification"
  FOR INSERT TO app_runtime
  WITH CHECK (
    app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardReferral" rr
      WHERE rr."referrerUserId" = "RewardNotification"."userId"
        AND app_api_key_reward_access(rr."rewardId")
    )
  );

-- ── financial rows of the key's store (checkout writes, tenant API reads)

DROP POLICY IF EXISTS reward_redemptions_api_key_read ON public."RewardRedemption";
CREATE POLICY reward_redemptions_api_key_read ON public."RewardRedemption"
  FOR SELECT TO app_runtime USING (app_api_key_store_access("tenantId", "locationId"));

DROP POLICY IF EXISTS reward_redemptions_api_key_insert ON public."RewardRedemption";
CREATE POLICY reward_redemptions_api_key_insert ON public."RewardRedemption"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_store_access("tenantId", "locationId"));

DROP POLICY IF EXISTS reward_sales_api_key_read ON public."RewardSale";
CREATE POLICY reward_sales_api_key_read ON public."RewardSale"
  FOR SELECT TO app_runtime USING (app_api_key_store_access("tenantId", "locationId"));

DROP POLICY IF EXISTS reward_sales_api_key_insert ON public."RewardSale";
CREATE POLICY reward_sales_api_key_insert ON public."RewardSale"
  FOR INSERT TO app_runtime WITH CHECK (app_api_key_store_access("tenantId", "locationId"));

-- ── audit trail of the key's tenant (append only)

DROP POLICY IF EXISTS reward_audit_logs_api_key_insert ON public."RewardAuditLog";
CREATE POLICY reward_audit_logs_api_key_insert ON public."RewardAuditLog"
  FOR INSERT TO app_runtime WITH CHECK ("tenantId" IS NOT NULL AND app_api_key_org_access("tenantId"));
