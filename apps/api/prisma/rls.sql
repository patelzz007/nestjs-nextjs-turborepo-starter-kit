-- ============================================================================
-- Row-Level Security setup — standalone, idempotent
-- ============================================================================
-- This file is the CANONICAL source for RLS in the project.  Prisma does not
-- support RLS natively, so `prisma migrate dev` and `prisma db push` never
-- emit these statements.  Run this AFTER every migration or push:
--
--   pnpm --filter @workspace/api db:rls
--
-- The file is idempotent: every statement uses DROP IF EXISTS / CREATE OR
-- REPLACE so it can be re-applied safely at any time.
-- ============================================================================

-- ── 1. app_runtime role ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

GRANT app_runtime TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- ── 2. RLS helper functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'false')::boolean;
$$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_owns(owner_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass() OR (app_current_user_id() IS NOT NULL AND app_current_user_id() = owner_id);
$$;

GRANT EXECUTE ON FUNCTION app_rls_bypass() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
GRANT EXECUTE ON FUNCTION app_owns(text) TO app_runtime;

-- ── 3. Enable RLS on every table ───────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'roles',
    'permissions',
    'permission_audit_logs',
    'menu_items',
    'menu_item_permissions',
    'menu_item_roles',
    'password_reset_tokens',
    'user_roles',
    'user_permissions',
    'role_permissions',
    'refresh_tokens',
    'urls',
    'tags',
    'url_tags',
    'clicks',
    'api_keys',
    'impersonation_audit_logs',
    'logs',
    'api_key_usage_logs',
    'email_logs',
    'backups',
    'telescope_requests',
    'telescope_queries',
    'telescope_exceptions',
    'telescope_dumps',
    'telescope_jobs',
    'telescope_alerts',
    'telescope_annotations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 4. Policies ────────────────────────────────────────────────────────────

-- ── Ownership policies (user-scoped tables) ────────────────────────────────

DROP POLICY IF EXISTS users_own ON public.users;
CREATE POLICY users_own ON public.users
  USING (app_owns(id))
  WITH CHECK (app_owns(id));

DROP POLICY IF EXISTS urls_own ON public.urls;
CREATE POLICY urls_own ON public.urls
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS tags_own ON public.tags;
CREATE POLICY tags_own ON public.tags
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS url_tags_via_url ON public.url_tags;
CREATE POLICY url_tags_via_url ON public.url_tags
  USING (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)));

DROP POLICY IF EXISTS clicks_via_url ON public.clicks;
CREATE POLICY clicks_via_url ON public.clicks
  USING (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.urls u WHERE u.id = url_id AND app_owns(u.user_id)));

DROP POLICY IF EXISTS api_keys_own ON public.api_keys;
CREATE POLICY api_keys_own ON public.api_keys
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS api_key_usage_via_key ON public.api_key_usage_logs;
CREATE POLICY api_key_usage_via_key ON public.api_key_usage_logs
  USING (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND app_owns(k.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND app_owns(k.user_id)));

DROP POLICY IF EXISTS refresh_tokens_own ON public.refresh_tokens;
CREATE POLICY refresh_tokens_own ON public.refresh_tokens
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

DROP POLICY IF EXISTS password_reset_tokens_own ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_own ON public.password_reset_tokens
  USING (app_owns(user_id))
  WITH CHECK (app_owns(user_id));

DROP POLICY IF EXISTS user_roles_own ON public.user_roles;
CREATE POLICY user_roles_own ON public.user_roles
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

DROP POLICY IF EXISTS user_permissions_own ON public.user_permissions;
CREATE POLICY user_permissions_own ON public.user_permissions
  USING (app_owns("userId"))
  WITH CHECK (app_owns("userId"));

-- ── Shared / RBAC tables (world-readable, bypass-only writes) ──────────────

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS roles_write ON public.roles;
CREATE POLICY roles_write ON public.roles
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS permissions_write ON public.permissions;
CREATE POLICY permissions_write ON public.permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_items_read ON public.menu_items;
CREATE POLICY menu_items_read ON public.menu_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_items_write ON public.menu_items;
CREATE POLICY menu_items_write ON public.menu_items
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_item_permissions_read ON public.menu_item_permissions;
CREATE POLICY menu_item_permissions_read ON public.menu_item_permissions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_item_permissions_write ON public.menu_item_permissions;
CREATE POLICY menu_item_permissions_write ON public.menu_item_permissions
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS menu_item_roles_read ON public.menu_item_roles;
CREATE POLICY menu_item_roles_read ON public.menu_item_roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_item_roles_write ON public.menu_item_roles;
CREATE POLICY menu_item_roles_write ON public.menu_item_roles
  FOR ALL
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Admin-only bypass tables ───────────────────────────────────────────────

DROP POLICY IF EXISTS backups_bypass ON public.backups;
CREATE POLICY backups_bypass ON public.backups
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- ── Append-mostly tables (insert public, select/update/delete via bypass) ──

DROP POLICY IF EXISTS logs_bypass ON public.logs;
CREATE POLICY logs_insert ON public.logs FOR INSERT WITH CHECK (true);
CREATE POLICY logs_select ON public.logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY logs_update ON public.logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY logs_delete ON public.logs FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS email_logs_bypass ON public.email_logs;
CREATE POLICY email_logs_insert ON public.email_logs FOR INSERT WITH CHECK (true);
CREATE POLICY email_logs_select ON public.email_logs FOR SELECT USING (app_rls_bypass());
CREATE POLICY email_logs_update ON public.email_logs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY email_logs_delete ON public.email_logs FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_requests_bypass ON public.telescope_requests;
CREATE POLICY telescope_requests_insert ON public.telescope_requests FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_requests_select ON public.telescope_requests FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_requests_update ON public.telescope_requests FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_requests_delete ON public.telescope_requests FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_queries_bypass ON public.telescope_queries;
CREATE POLICY telescope_queries_insert ON public.telescope_queries FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_queries_select ON public.telescope_queries FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_queries_update ON public.telescope_queries FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_queries_delete ON public.telescope_queries FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_exceptions_bypass ON public.telescope_exceptions;
CREATE POLICY telescope_exceptions_insert ON public.telescope_exceptions FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_exceptions_select ON public.telescope_exceptions FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_exceptions_update ON public.telescope_exceptions FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_exceptions_delete ON public.telescope_exceptions FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_dumps_bypass ON public.telescope_dumps;
CREATE POLICY telescope_dumps_insert ON public.telescope_dumps FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_dumps_select ON public.telescope_dumps FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_dumps_update ON public.telescope_dumps FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_dumps_delete ON public.telescope_dumps FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_jobs_bypass ON public.telescope_jobs;
CREATE POLICY telescope_jobs_insert ON public.telescope_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_jobs_select ON public.telescope_jobs FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_jobs_update ON public.telescope_jobs FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_jobs_delete ON public.telescope_jobs FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_alerts_bypass ON public.telescope_alerts;
CREATE POLICY telescope_alerts_insert ON public.telescope_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_alerts_select ON public.telescope_alerts FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_alerts_update ON public.telescope_alerts FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_alerts_delete ON public.telescope_alerts FOR DELETE USING (app_rls_bypass());

DROP POLICY IF EXISTS telescope_annotations_bypass ON public.telescope_annotations;
CREATE POLICY telescope_annotations_insert ON public.telescope_annotations FOR INSERT WITH CHECK (true);
CREATE POLICY telescope_annotations_select ON public.telescope_annotations FOR SELECT USING (app_rls_bypass());
CREATE POLICY telescope_annotations_update ON public.telescope_annotations FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());
CREATE POLICY telescope_annotations_delete ON public.telescope_annotations FOR DELETE USING (app_rls_bypass());

-- ── Audit tables (bypass-only) ─────────────────────────────────────────────

DROP POLICY IF EXISTS permission_audit_logs_bypass ON public.permission_audit_logs;
CREATE POLICY permission_audit_logs_bypass ON public.permission_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_bypass ON public.impersonation_audit_logs
  USING (app_rls_bypass())
  WITH CHECK (app_rls_bypass());

-- Impersonation audit is append-only for app_runtime (not representable in PSL).
REVOKE UPDATE, DELETE ON TABLE public.impersonation_audit_logs FROM app_runtime;

DROP POLICY IF EXISTS impersonation_audit_logs_bypass ON public.impersonation_audit_logs;

DROP POLICY IF EXISTS impersonation_audit_logs_select ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_select ON public.impersonation_audit_logs
  FOR SELECT
  TO app_runtime
  USING (app_rls_bypass());

DROP POLICY IF EXISTS impersonation_audit_logs_insert ON public.impersonation_audit_logs;
CREATE POLICY impersonation_audit_logs_insert ON public.impersonation_audit_logs
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_rls_bypass());
