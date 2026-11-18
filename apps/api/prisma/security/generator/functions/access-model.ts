import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/**
 * The access model in PostgreSQL (ADR 067): the same allow paths as the API's `AccessDecider`
 * (src/contexts/authorization/domain/access/), so a bug in one layer is caught by the other.
 *
 *   app_has_permission(resource, action, tenant, store)
 *       ROLE  — the caller's ACTIVE membership in the tenant, whose tenant role holds `resource.action`,
 *               and whose stores cover `store`; or
 *       GRANT — a live (unexpired, not revoked) grant of `resource.action` in the tenant, whose store (if
 *               any) is `store` — and the membership's stores cover `store` too (grant ∩ membership).
 *   app_shared(resource, id, level)
 *       SHARE — a live share of that one record with the caller's ACTIVE membership, at `level` or higher
 *               (EDIT includes VIEW).
 *
 * OWNERSHIP is `app_owns("userId")` (session.ts). There is no deny row: anything none of these allows is
 * denied. A session bound to a tenant reaches only that tenant (as `app_member_of`). `store` NULL is a
 * tenant-level record. Like the other helpers, these never grant a system-operation bypass.
 */
export const ACCESS_MODEL_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_has_permission",
		signature: "app_has_permission(text, text, text, text)",
		description: "The ROLE and GRANT allow paths: the caller's role or a live grant gives resource.action in the tenant, at the store.",
		definition: sql`CREATE OR REPLACE FUNCTION app_has_permission(want_resource text, want_action text, org_id text, loc_id text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH member AS (
    SELECT m.id, m."roleId"
    FROM public."Membership" m
    WHERE app_current_user_id() IS NOT NULL
      AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = org_id)
      AND m."tenantId" = org_id
      AND m."userId" = app_current_user_id()
      AND m.status = 'ACTIVE'
      AND m."isDeleted" = false
  ),
  -- The membership's stores cover the record (a deleted store drops out of the scope).
  covered AS (
    SELECT 1 FROM member
    WHERE loc_id IS NULL
       OR EXISTS (
         SELECT 1 FROM public."MembershipLocationScope" s
         LEFT JOIN public."Location" l ON l.id = s."locationId"
         WHERE s."membershipId" = member.id
           AND s."isDeleted" = false
           AND (s."scopeType" = 'ALL_LOCATIONS' OR (s."locationId" = loc_id AND l."isDeleted" = false))
       )
  ),
  -- The exact verb asked for: there is no catch-all action (as \`permissionSatisfies\`).
  wanted AS (
    SELECT p.id FROM public."Permission" p
    WHERE p."isDeleted" = false
      AND p.scope NOT IN ('OWN', 'RESOURCE')
      AND p.resource::text = want_resource
      AND p.action::text = want_action
  )
  SELECT EXISTS (SELECT 1 FROM covered) AND (
    EXISTS (
      SELECT 1 FROM member
      JOIN public."Role" r ON r.id = member."roleId"
      JOIN public."RolePermission" rp ON rp."roleId" = r.id
      WHERE r."isDeleted" = false AND r."isActive" = true AND r.kind = 'TENANT' AND r."tenantId" = org_id
        AND rp."isDeleted" = false
        AND rp."permissionId" IN (SELECT id FROM wanted)
    )
    OR EXISTS (
      SELECT 1 FROM public."UserPermission" g
      LEFT JOIN public."Location" l ON l.id = g."locationId"
      WHERE g."userId" = app_current_user_id()
        AND g."tenantId" = org_id
        AND g.effect = 'ALLOW'
        AND g."isDeleted" = false
        AND (g."expiresAt" IS NULL OR g."expiresAt" > (EXTRACT(epoch FROM now()) * 1000)::bigint)
        AND g."permissionId" IN (SELECT id FROM wanted)
        -- A store-limited grant reaches only that store, never a tenant-level record.
        AND (g."locationId" IS NULL OR (g."locationId" = loc_id AND l."isDeleted" = false))
    )
  );
$$;

COMMENT ON FUNCTION app_has_permission(text, text, text, text) IS
  'ADR 067: the caller''s role or a live grant gives resource.action in the tenant, at the store (NULL: tenant-level).';`,
	},
	{
		name: "app_permitted_tenants",
		signature: "app_permitted_tenants(text, text)",
		description:
			"Every tenant where the caller may do resource.action on a tenant-level record: app_has_permission(…, tenant, NULL) for all tenants at once, so a policy asks once per statement, not once per row.",
		definition: sql`CREATE OR REPLACE FUNCTION app_permitted_tenants(want_resource text, want_action text) RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH member AS (
    SELECT m.id, m."roleId", m."tenantId"
    FROM public."Membership" m
    WHERE app_current_user_id() IS NOT NULL
      AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = m."tenantId")
      AND m."userId" = app_current_user_id()
      AND m.status = 'ACTIVE'
      AND m."isDeleted" = false
  ),
  wanted AS (
    SELECT p.id FROM public."Permission" p
    WHERE p."isDeleted" = false
      AND p.scope NOT IN ('OWN', 'RESOURCE')
      AND p.resource::text = want_resource
      AND p.action::text = want_action
  ),
  by_role AS (
    SELECT member."tenantId" FROM member
    JOIN public."Role" r ON r.id = member."roleId"
    JOIN public."RolePermission" rp ON rp."roleId" = r.id
    WHERE r."isDeleted" = false AND r."isActive" = true AND r.kind = 'TENANT' AND r."tenantId" = member."tenantId"
      AND rp."isDeleted" = false
      AND rp."permissionId" IN (SELECT id FROM wanted)
  ),
  -- A store-limited grant never reaches a tenant-level record.
  by_grant AS (
    SELECT member."tenantId" FROM member
    JOIN public."UserPermission" g ON g."tenantId" = member."tenantId"
    WHERE g."userId" = app_current_user_id()
      AND g.effect = 'ALLOW'
      AND g."isDeleted" = false
      AND (g."expiresAt" IS NULL OR g."expiresAt" > (EXTRACT(epoch FROM now()) * 1000)::bigint)
      AND g."permissionId" IN (SELECT id FROM wanted)
      AND g."locationId" IS NULL
  )
  SELECT coalesce(array_agg(DISTINCT allowed."tenantId"), ARRAY[]::text[])
  FROM (SELECT "tenantId" FROM by_role UNION SELECT "tenantId" FROM by_grant) AS allowed;
$$;

COMMENT ON FUNCTION app_permitted_tenants(text, text) IS
  'ADR 090: the tenants where the caller''s role or a live tenant-wide grant gives resource.action (tenant-level records); one call per statement.';`,
	},
	{
		name: "app_permitted_stores",
		signature: "app_permitted_stores(text, text)",
		description:
			"Every store where the caller may do resource.action, as 'tenant|store' keys ('tenant|*' for every store of a tenant): app_has_permission(…, tenant, store) for all stores at once, asked once per statement.",
		definition: sql`CREATE OR REPLACE FUNCTION app_permitted_stores(want_resource text, want_action text) RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH member AS (
    SELECT m.id, m."roleId", m."tenantId"
    FROM public."Membership" m
    WHERE app_current_user_id() IS NOT NULL
      AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = m."tenantId")
      AND m."userId" = app_current_user_id()
      AND m.status = 'ACTIVE'
      AND m."isDeleted" = false
  ),
  -- The stores each membership covers: '*' for all of them, otherwise each live selected store.
  covered AS (
    SELECT member.id AS membership_id, member."tenantId", '*'::text AS store
    FROM member
    WHERE EXISTS (
      SELECT 1 FROM public."MembershipLocationScope" s
      WHERE s."membershipId" = member.id AND s."isDeleted" = false AND s."scopeType" = 'ALL_LOCATIONS'
    )
    UNION
    SELECT member.id, member."tenantId", s."locationId"
    FROM member
    JOIN public."MembershipLocationScope" s ON s."membershipId" = member.id
    JOIN public."Location" l ON l.id = s."locationId"
    WHERE s."isDeleted" = false AND s."scopeType" = 'SELECTED' AND l."isDeleted" = false
  ),
  wanted AS (
    SELECT p.id FROM public."Permission" p
    WHERE p."isDeleted" = false
      AND p.scope NOT IN ('OWN', 'RESOURCE')
      AND p.resource::text = want_resource
      AND p.action::text = want_action
  ),
  -- The role, or a tenant-wide grant, gives it at every store the membership covers.
  tenant_wide AS (
    SELECT member.id AS membership_id FROM member
    JOIN public."Role" r ON r.id = member."roleId"
    JOIN public."RolePermission" rp ON rp."roleId" = r.id
    WHERE r."isDeleted" = false AND r."isActive" = true AND r.kind = 'TENANT' AND r."tenantId" = member."tenantId"
      AND rp."isDeleted" = false
      AND rp."permissionId" IN (SELECT id FROM wanted)
    UNION
    SELECT member.id FROM member
    JOIN public."UserPermission" g ON g."tenantId" = member."tenantId"
    WHERE g."userId" = app_current_user_id()
      AND g.effect = 'ALLOW'
      AND g."isDeleted" = false
      AND (g."expiresAt" IS NULL OR g."expiresAt" > (EXTRACT(epoch FROM now()) * 1000)::bigint)
      AND g."permissionId" IN (SELECT id FROM wanted)
      AND g."locationId" IS NULL
  ),
  -- A store-limited grant gives it at that live store, when the membership covers it.
  store_grants AS (
    SELECT covered."tenantId", g."locationId" AS store
    FROM covered
    JOIN public."UserPermission" g ON g."tenantId" = covered."tenantId"
    JOIN public."Location" l ON l.id = g."locationId"
    WHERE g."userId" = app_current_user_id()
      AND g.effect = 'ALLOW'
      AND g."isDeleted" = false
      AND (g."expiresAt" IS NULL OR g."expiresAt" > (EXTRACT(epoch FROM now()) * 1000)::bigint)
      AND g."permissionId" IN (SELECT id FROM wanted)
      AND l."isDeleted" = false
      AND (covered.store = '*' OR covered.store = g."locationId")
  )
  SELECT coalesce(array_agg(DISTINCT allowed.key), ARRAY[]::text[])
  FROM (
    SELECT covered."tenantId" || '|' || covered.store AS key FROM covered JOIN tenant_wide ON tenant_wide.membership_id = covered.membership_id
    UNION
    SELECT store_grants."tenantId" || '|' || store_grants.store FROM store_grants
  ) AS allowed;
$$;

COMMENT ON FUNCTION app_permitted_stores(text, text) IS
  'ADR 090: the stores where the caller''s role or a live grant gives resource.action, as tenant|store keys (tenant|* = every store); one call per statement.';`,
	},
	{
		name: "app_shared",
		signature: "app_shared(text, text, text)",
		description: "The SHARE allow path: one record shared with the caller's active membership, at the level or higher.",
		definition: sql`CREATE OR REPLACE FUNCTION app_shared(want_resource text, record_id text, want_level text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public."ResourceAcl" a
    JOIN public."Membership" m ON m.id = a."membershipId"
    WHERE a."resourceType" = want_resource
      AND a."resourceId" = record_id
      AND a."isDeleted" = false
      AND (a."expiresAt" IS NULL OR a."expiresAt" > (EXTRACT(epoch FROM now()) * 1000)::bigint)
      AND (a.level::text = want_level OR a.level = 'EDIT')
      AND m."userId" = app_current_user_id()
      AND m.status = 'ACTIVE'
      AND m."isDeleted" = false
      AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = m."tenantId")
  );
$$;

COMMENT ON FUNCTION app_shared(text, text, text) IS
  'ADR 067: one record shared with the caller''s active membership, at the level or higher (EDIT includes VIEW).';`,
	},
];
