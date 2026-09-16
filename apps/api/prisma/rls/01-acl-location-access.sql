-- ============================================================================
-- ACL + ReBAC helpers and location-scoped policies
-- ============================================================================
-- Applied BEFORE prisma/rls.sql so bundle policies can call these functions.
-- ReBAC: organization membership (relationship to org).
-- ACL: branch/location scope within the active tenant session.
-- ============================================================================

-- ── ReBAC: organization membership ───────────────────────────────────────────

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

COMMENT ON FUNCTION app_organization_member_of(text) IS
  'ReBAC: user has an active membership in the organization (any tenant context).';

GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_runtime;

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

COMMENT ON FUNCTION app_tenant_organization_member_of(text) IS
  'ReBAC: active tenant session org matches row org and user is a member (fail-closed).';

GRANT EXECUTE ON FUNCTION app_tenant_organization_member_of(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_member(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_rls_bypass()
    OR app_tenant_organization_member_of(org_id)
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
  SELECT app_rls_bypass()
    OR (
      app_current_user_id() IS NOT NULL
      AND app_current_organization_id() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_locations loc
        INNER JOIN public.organization_memberships m
          ON m.organization_id = loc.organization_id
         AND m.user_id = app_current_user_id()
         AND m.status = 'ACTIVE'
         AND m.is_deleted = false
        WHERE loc.id = loc_id
          AND loc.organization_id = app_current_organization_id()
          AND (
            EXISTS (
              SELECT 1
              FROM public.organization_membership_location_scopes s
              WHERE s.membership_id = m.id
                AND s.scope_type = 'ALL_LOCATIONS'
            )
            OR EXISTS (
              SELECT 1
              FROM public.organization_membership_location_scopes s
              WHERE s.membership_id = m.id
                AND s.scope_type = 'SELECTED'
                AND s.location_id = loc_id
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
  SELECT app_rls_bypass()
    OR (
      app_current_organization_id() IS NOT NULL
      AND row_organization_id = app_current_organization_id()
      AND app_tenant_has_location_access(row_location_id)
    );
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
  SELECT app_rls_bypass()
    OR (
      app_tenant_org_member(row_organization_id)
      AND (
        row_location_id IS NULL
        OR row_location_id = ''
        OR app_tenant_has_location_access(row_location_id)
      )
    );
$$;

COMMENT ON FUNCTION app_tenant_org_optional_location_access(text, text) IS
  'ReBAC + ACL: org member; when location_id is set, user must have branch ACL.';

GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;

-- ── Location-scoped POS resources (organization_location profile) ───────────

DROP POLICY IF EXISTS organization_terminals_org ON public.organization_terminals;
DROP POLICY IF EXISTS organization_terminals_tenant_acl ON public.organization_terminals;
CREATE POLICY organization_terminals_tenant_acl ON public.organization_terminals
  FOR ALL
  TO app_runtime
  USING (app_tenant_row_org_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_row_org_location_access(organization_id, location_id));

DROP POLICY IF EXISTS organization_api_keys_org ON public.organization_api_keys;
DROP POLICY IF EXISTS organization_api_keys_tenant_acl ON public.organization_api_keys;
CREATE POLICY organization_api_keys_tenant_acl ON public.organization_api_keys
  FOR ALL
  TO app_runtime
  USING (app_tenant_org_optional_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_org_optional_location_access(organization_id, location_id));
