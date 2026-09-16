-- ============================================================================
-- Generic ACL: organization + location (branch) scope
-- ============================================================================
-- Role-agnostic. Uses membership + location scope rows — not application role
-- names. Use in policies for tables with organization_id + location_id.
-- ============================================================================

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
  'True when the session user has ACL access to the location within app.current_organization_id (fail-closed).';

GRANT EXECUTE ON FUNCTION app_tenant_has_location_access(text) TO app_runtime;

-- Convenience for tables that carry both organization_id and location_id columns.
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
  'Tenant isolation: org must match session org and user must have location ACL.';

GRANT EXECUTE ON FUNCTION app_tenant_row_org_location_access(text, text) TO app_runtime;
