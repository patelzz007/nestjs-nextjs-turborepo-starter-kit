-- ============================================================================
-- The access model in Postgres (ADR 067): the same allow paths as the API
-- ============================================================================
-- RLS is the primary enforcer; these helpers answer exactly what the API's
-- `AccessDecider` answers (`apps/api/src/contexts/authorization/domain/access/`),
-- so a bug in one layer is caught by the other:
--
--   app_has_permission(resource, action, tenant, store)
--       ROLE  — the caller's ACTIVE membership in the tenant, whose tenant role
--               holds `resource.action`, and whose stores cover `store`; or
--       GRANT — a live (unexpired, not revoked) grant of `resource.action` in the
--               tenant, whose store (if any) is `store` — and the membership's
--               stores cover `store` too (grant ∩ membership).
--   app_shared(resource, id, level)
--       SHARE — a live share of that one record with the caller's ACTIVE
--               membership, at `level` or higher (EDIT includes VIEW).
--
-- OWNERSHIP is `app_owns("userId")` (00-app-helpers.sql). There is no deny row:
-- anything none of these allows is denied. A session bound to a tenant reaches
-- only that tenant (as `app_member_of`). `store` NULL is a tenant-level record.
-- Like the other helpers, these never grant a system-operation bypass.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_has_permission(want_resource text, want_action text, org_id text, loc_id text) RETURNS boolean
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
  -- The exact verb asked for: there is no catch-all action (as `permissionSatisfies`).
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
  'ADR 067: the caller''s role or a live grant gives resource.action in the tenant, at the store (NULL: tenant-level).';

GRANT EXECUTE ON FUNCTION app_has_permission(text, text, text, text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_shared(want_resource text, record_id text, want_level text) RETURNS boolean
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
  'ADR 067: one record shared with the caller''s active membership, at the level or higher (EDIT includes VIEW).';

GRANT EXECUTE ON FUNCTION app_shared(text, text, text) TO app_runtime;
