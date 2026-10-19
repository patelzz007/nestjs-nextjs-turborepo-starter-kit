-- ============================================================================
-- ACL + ReBAC helpers and location-scoped policies
-- ============================================================================
-- Applied BEFORE prisma/rls.sql so bundle policies can call these functions.
-- ReBAC: organization membership (relationship to org).
-- ACL: branch/location scope within the active tenant session.
-- ============================================================================

-- These helpers answer ONE question — does the session's user/tenant relate to
-- the row? — and never grant a system-operation bypass themselves. A policy that
-- admits system operations says so explicitly, naming its own table:
-- `(SELECT app_rls_bypass_on('<table>')) OR <helper>(…)` (ADR 012, scoped bypass).

-- ── ReBAC: organization membership ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_organization_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_current_user_id() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public."OrganizationMembership" m
      WHERE m."organizationId" = org_id
        AND m."userId" = app_current_user_id()
        AND m.status = 'ACTIVE'
        AND m."isDeleted" = false
    );
$$;

COMMENT ON FUNCTION app_organization_member_of(text) IS
  'ReBAC: user has an active membership in the organization (any tenant context).';

GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_organization_member_of(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_current_user_id() IS NOT NULL
    AND app_current_organization_id() IS NOT NULL
    AND app_current_organization_id() = org_id
    AND EXISTS (
      SELECT 1 FROM public."OrganizationMembership" m
      WHERE m."organizationId" = org_id
        AND m."userId" = app_current_user_id()
        AND m.status = 'ACTIVE'
        AND m."isDeleted" = false
    );
$$;

COMMENT ON FUNCTION app_tenant_organization_member_of(text) IS
  'ReBAC: active tenant session org matches row org and user is a member (fail-closed).';

GRANT EXECUTE ON FUNCTION app_tenant_organization_member_of(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_member(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_tenant_organization_member_of(org_id)
    OR app_organization_member_of(org_id);
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
      AND app_current_organization_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."OrganizationLocation" loc
        INNER JOIN public."OrganizationMembership" m
          ON m."organizationId" = loc."organizationId"
         AND m."userId" = app_current_user_id()
         AND m.status = 'ACTIVE'
         AND m."isDeleted" = false
        WHERE loc.id = loc_id
          AND loc."organizationId" = app_current_organization_id()
          AND (
            EXISTS (
              SELECT 1
              FROM public."OrganizationMembershipLocationScope" s
              WHERE s."membershipId" = m.id
                AND s."isDeleted" = false
                AND s."scopeType" = 'ALL_LOCATIONS'
            )
            OR EXISTS (
              SELECT 1
              FROM public."OrganizationMembershipLocationScope" s
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
  'ACL: session user may access the location within app.current_organization_id.';

GRANT EXECUTE ON FUNCTION app_tenant_has_location_access(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_row_org_location_access(
  row_organization_id text,
  row_location_id text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_organization_id() IS NOT NULL
    AND row_organization_id = app_current_organization_id()
    AND app_tenant_has_location_access(row_location_id);
$$;

COMMENT ON FUNCTION app_tenant_row_org_location_access(text, text) IS
  'ACL: row org matches session org and user has location scope for row location.';

GRANT EXECUTE ON FUNCTION app_tenant_row_org_location_access(text, text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_optional_location_access(
  row_organization_id text,
  row_location_id text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_tenant_org_member(row_organization_id)
    AND (
      row_location_id IS NULL
      OR row_location_id = ''
      OR app_tenant_has_location_access(row_location_id)
    );
$$;

COMMENT ON FUNCTION app_tenant_org_optional_location_access(text, text) IS
  'ReBAC + ACL: org member; when "locationId" is set, user must have branch ACL.';

GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;

-- ── Location-scoped POS resources (organization_location profile) ───────────

DROP POLICY IF EXISTS organization_terminals_org ON public."OrganizationTerminal";
DROP POLICY IF EXISTS organization_terminals_tenant_acl ON public."OrganizationTerminal";
CREATE POLICY organization_terminals_tenant_acl ON public."OrganizationTerminal"
  FOR ALL
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('OrganizationTerminal')) OR (app_tenant_row_org_location_access("organizationId", "locationId")))
  WITH CHECK ((SELECT app_rls_bypass_on('OrganizationTerminal')) OR (app_tenant_row_org_location_access("organizationId", "locationId")));

DROP POLICY IF EXISTS organization_api_keys_org ON public."OrganizationApiKey";
DROP POLICY IF EXISTS organization_api_keys_tenant_acl ON public."OrganizationApiKey";
CREATE POLICY organization_api_keys_tenant_acl ON public."OrganizationApiKey"
  FOR ALL
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('OrganizationApiKey')) OR (app_tenant_org_optional_location_access("organizationId", "locationId")))
  WITH CHECK ((SELECT app_rls_bypass_on('OrganizationApiKey')) OR (app_tenant_org_optional_location_access("organizationId", "locationId")));
