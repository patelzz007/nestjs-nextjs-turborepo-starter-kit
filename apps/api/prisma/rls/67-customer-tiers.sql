-- ============================================================================
-- 67 — Customer tiers (ADR 085)
-- ============================================================================
-- Why hand-written (ADR 078 §1): Prisma has no syntax for row-level security policies, and these two rules are
-- one-offs (a read-only owner rule, and the till's read of its own customers' tiers).
--
-- A customer's tier is the tiers context's to write: every write (and platform staff's and a merchant's reads,
-- which the API scopes) goes through a `tiers.*` system operation — those are the generated `system` policies in
-- 97-standard-policies.sql. Here:
--   * the customer reads their OWN standing and tier history (never writes them);
--   * a merchant API key (the till, mid-checkout) reads the standing of its tenant's customers, so the redemption
--     can record the customer's tier at that moment. A claimant is always one of the tenant's customers
--     (`TenantCustomer`, written by the claim), so the key sees exactly the people its codes belong to.
-- Idempotent: re-applied by every `db:apply-security`.
--
-- Rollback: `DROP POLICY customer_tier_standings_own_read ON public."CustomerTierStanding";`,
-- `DROP POLICY customer_tier_standings_api_key_read ON public."CustomerTierStanding";`,
-- `DROP POLICY customer_tier_changes_own_read ON public."CustomerTierChange";` and
-- `DROP FUNCTION app_api_key_customer_access(text);` (the tables then admit only their system operations).
-- ============================================================================

ALTER TABLE public."CustomerTierStanding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerTierStanding" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerTierChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerTierChange" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerTierSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomerTierSettings" FORCE ROW LEVEL SECURITY;

-- The user is a customer of the API key's tenant. SECURITY DEFINER so the lookup does not depend on
-- `TenantCustomer`'s own policies; it still checks the key's tenant through the session helpers.
CREATE OR REPLACE FUNCTION app_api_key_customer_access("customerUserId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_api_key_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."TenantCustomer" tc
      WHERE tc."userId" = "customerUserId"
        AND tc."isDeleted" = false
        AND app_api_key_org_access(tc."tenantId")
    );
$$;

GRANT EXECUTE ON FUNCTION app_api_key_customer_access(text) TO app_runtime;

DROP POLICY IF EXISTS customer_tier_standings_own_read ON public."CustomerTierStanding";
CREATE POLICY customer_tier_standings_own_read ON public."CustomerTierStanding"
  FOR SELECT USING (app_owns("userId"));

DROP POLICY IF EXISTS customer_tier_standings_api_key_read ON public."CustomerTierStanding";
CREATE POLICY customer_tier_standings_api_key_read ON public."CustomerTierStanding"
  FOR SELECT TO app_runtime USING (app_api_key_customer_access("userId"));

DROP POLICY IF EXISTS customer_tier_changes_own_read ON public."CustomerTierChange";
CREATE POLICY customer_tier_changes_own_read ON public."CustomerTierChange"
  FOR SELECT USING (app_owns("userId"));
