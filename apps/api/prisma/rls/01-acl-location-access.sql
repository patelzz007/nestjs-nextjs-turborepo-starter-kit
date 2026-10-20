-- ============================================================================
-- ACL + ReBAC helpers and location-scoped policies
-- ============================================================================
-- Applied BEFORE prisma/rls.sql so bundle policies can call these functions.
-- ReBAC: tenant membership (relationship to org).
-- ACL: branch/location scope within the active tenant session.
-- ============================================================================

-- These helpers answer ONE question — does the session's user/tenant relate to
-- the row? — and never grant a system-operation bypass themselves. A policy that
-- admits system operations says so explicitly, naming its own table:
-- `(SELECT app_rls_bypass_on('<table>')) OR <helper>(…)` (ADR 012, scoped bypass).

-- ── ReBAC: tenant membership ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_current_user_id() IS NOT NULL
    -- A session bound to a tenant (a tenant route) is confined to it: a member of tenants A and B
    -- working on A's route reaches only A's rows. Tenantless sessions (listing one's memberships,
    -- choosing a tenant) still see every tenant they belong to. Multi-tenancy plan D10, ADR 062.
    AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = org_id)
    AND EXISTS (
      SELECT 1 FROM public."Membership" m
      WHERE m."tenantId" = org_id
        AND m."userId" = app_current_user_id()
        AND m.status = 'ACTIVE'
        AND m."isDeleted" = false
    );
$$;

COMMENT ON FUNCTION app_member_of(text) IS
  'ReBAC: user has an active membership in the tenant; when the session names a tenant, only that tenant.';

GRANT EXECUTE ON FUNCTION app_member_of(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_current_user_id() IS NOT NULL
    AND app_current_tenant_id() IS NOT NULL
    AND app_current_tenant_id() = org_id
    AND EXISTS (
      SELECT 1 FROM public."Membership" m
      WHERE m."tenantId" = org_id
        AND m."userId" = app_current_user_id()
        AND m.status = 'ACTIVE'
        AND m."isDeleted" = false
    );
$$;

COMMENT ON FUNCTION app_tenant_member_of(text) IS
  'ReBAC: active tenant session org matches row org and user is a member (fail-closed).';

GRANT EXECUTE ON FUNCTION app_tenant_member_of(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_member(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_tenant_member_of(org_id)
    OR app_member_of(org_id);
$$;

COMMENT ON FUNCTION app_tenant_org_member(text) IS
  'ReBAC: tenant-scoped org member when session org is set; otherwise legacy membership check.';

GRANT EXECUTE ON FUNCTION app_tenant_org_member(text) TO app_runtime;

-- ── ACL: location (branch) scope within tenant ─────────────────────────────

CREATE OR REPLACE FUNCTION app_tenant_has_location_access(loc_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
      app_current_user_id() IS NOT NULL
      AND app_current_tenant_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."Location" loc
        INNER JOIN public."Membership" m
          ON m."tenantId" = loc."tenantId"
         AND m."userId" = app_current_user_id()
         AND m.status = 'ACTIVE'
         AND m."isDeleted" = false
        WHERE loc.id = loc_id
          AND loc."tenantId" = app_current_tenant_id()
          AND (
            EXISTS (
              SELECT 1
              FROM public."MembershipLocationScope" s
              WHERE s."membershipId" = m.id
                AND s."isDeleted" = false
                AND s."scopeType" = 'ALL_LOCATIONS'
            )
            OR EXISTS (
              SELECT 1
              FROM public."MembershipLocationScope" s
              WHERE s."membershipId" = m.id
                AND s."isDeleted" = false
                AND s."scopeType" = 'SELECTED'
                AND s."locationId" = loc_id
            )
          )
      )
    );
$$;

COMMENT ON FUNCTION app_tenant_has_location_access(text) IS
  'ACL: session user may access the location within app.current_tenant_id.';

GRANT EXECUTE ON FUNCTION app_tenant_has_location_access(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_row_org_location_access(
  row_tenant_id text,
  row_location_id text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_tenant_id() IS NOT NULL
    AND row_tenant_id = app_current_tenant_id()
    AND app_tenant_has_location_access(row_location_id);
$$;

COMMENT ON FUNCTION app_tenant_row_org_location_access(text, text) IS
  'ACL: row org matches session org and user has location scope for row location.';

GRANT EXECUTE ON FUNCTION app_tenant_row_org_location_access(text, text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_optional_location_access(
  row_tenant_id text,
  row_location_id text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_tenant_org_member(row_tenant_id)
    AND (
      row_location_id IS NULL
      OR row_location_id = ''
      OR app_tenant_has_location_access(row_location_id)
    );
$$;

COMMENT ON FUNCTION app_tenant_org_optional_location_access(text, text) IS
  'ReBAC + ACL: org member; when "locationId" is set, user must have branch ACL.';

GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;

-- ── Location-scoped POS resources (location profile) ───────────

DROP POLICY IF EXISTS tenant_terminals_org ON public."TenantTerminal";
DROP POLICY IF EXISTS tenant_terminals_tenant_acl ON public."TenantTerminal";
CREATE POLICY tenant_terminals_tenant_acl ON public."TenantTerminal"
  FOR ALL
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('TenantTerminal')) OR (app_tenant_row_org_location_access("tenantId", "locationId")))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantTerminal')) OR (app_tenant_row_org_location_access("tenantId", "locationId")));

DROP POLICY IF EXISTS tenant_api_keys_org ON public."TenantApiKey";
DROP POLICY IF EXISTS tenant_api_keys_tenant_acl ON public."TenantApiKey";
CREATE POLICY tenant_api_keys_tenant_acl ON public."TenantApiKey"
  FOR ALL
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('TenantApiKey')) OR (app_tenant_org_optional_location_access("tenantId", "locationId")))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantApiKey')) OR (app_tenant_org_optional_location_access("tenantId", "locationId")));
