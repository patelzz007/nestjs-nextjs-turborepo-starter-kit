import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/**
 * Tenant membership (ReBAC) and store scope (ACL). These helpers answer ONE question — does the session's
 * user/tenant relate to the row? — and never grant a system-operation bypass themselves. A policy that
 * admits system operations says so explicitly, naming its own table:
 * `(SELECT app_rls_bypass_on('<table>')) OR <helper>(…)` (ADR 012, scoped bypass).
 */
export const MEMBERSHIP_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_member_of",
		signature: "app_member_of(text)",
		description: "The user has an active membership in the tenant; when the session names a tenant, only that tenant.",
		definition: sql`CREATE OR REPLACE FUNCTION app_member_of(org_id text) RETURNS boolean
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
  'ReBAC: user has an active membership in the tenant; when the session names a tenant, only that tenant.';`,
	},
	{
		name: "app_tenant_member_of",
		signature: "app_tenant_member_of(text)",
		description: "The session is bound to this tenant and its user is an active member (fails closed without a tenant).",
		definition: sql`CREATE OR REPLACE FUNCTION app_tenant_member_of(org_id text) RETURNS boolean
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
  'ReBAC: active tenant session org matches row org and user is a member (fail-closed).';`,
	},
	{
		name: "app_tenant_org_member",
		signature: "app_tenant_org_member(text)",
		description: "A member of the tenant: through the bound tenant when the session has one, otherwise any active membership.",
		definition: sql`CREATE OR REPLACE FUNCTION app_tenant_org_member(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_tenant_member_of(org_id)
    OR app_member_of(org_id);
$$;

COMMENT ON FUNCTION app_tenant_org_member(text) IS
  'ReBAC: tenant-scoped org member when session org is set; otherwise legacy membership check.';`,
	},
	{
		name: "app_tenant_has_location_access",
		signature: "app_tenant_has_location_access(text)",
		description: "The session's user may work at this store of the bound tenant (all stores, or this one selected).",
		definition: sql`CREATE OR REPLACE FUNCTION app_tenant_has_location_access(loc_id text) RETURNS boolean
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
  'ACL: session user may access the location within app.current_tenant_id.';`,
	},
	{
		name: "app_tenant_row_org_location_access",
		signature: "app_tenant_row_org_location_access(text, text)",
		description: "The row is the bound tenant's and the user may work at the row's store.",
		definition: sql`CREATE OR REPLACE FUNCTION app_tenant_row_org_location_access(
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
  'ACL: row org matches session org and user has location scope for row location.';`,
	},
	{
		name: "app_tenant_org_optional_location_access",
		signature: "app_tenant_org_optional_location_access(text, text)",
		description: "A member of the row's tenant; when the row names a store, the user must also have that store.",
		definition: sql`CREATE OR REPLACE FUNCTION app_tenant_org_optional_location_access(
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
  'ReBAC + ACL: org member; when "locationId" is set, user must have branch ACL.';`,
	},
];
