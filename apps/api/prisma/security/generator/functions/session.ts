import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/**
 * The session primitives every other function and policy builds on. They read the transaction-local
 * settings the API stamps on each connection (src/prisma/rls-context.ts).
 *
 * A helper that calls another names it schema-qualified (`public.app_…`): SQL function bodies resolve names
 * through the CALLER's search_path, so a caller with a strict path (a trigger pinned to `pg_catalog`) would
 * otherwise fail with "function app_… does not exist". Qualifying, rather than a `SET search_path` clause,
 * keeps these functions inlinable into the policies that call them per row (helper-qualification.spec.ts).
 */
export const SESSION_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_system_operation",
		signature: "app_system_operation()",
		description: "The allowlisted system operation the session runs under (NULL for user / anonymous sessions); set by the API pool checkout and `withSystemOperation`.",
		definition: sql`CREATE OR REPLACE FUNCTION app_system_operation() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.system_operation', true), '');
$$;`,
	},
	{
		name: "app_rls_bypass",
		signature: "app_rls_bypass()",
		description: "A bypass only when the session BOTH asks for it AND names the allowlisted system operation that justifies it (ADR 012).",
		definition: sql`CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.rls_bypass', true), ''), 'false')::boolean
     AND public.app_system_operation() IS NOT NULL;
$$;`,
	},
	{
		name: "app_current_user_id",
		signature: "app_current_user_id()",
		description: "The signed-in user of the session, or NULL.",
		definition: sql`CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;`,
	},
	{
		name: "app_current_tenant_id",
		signature: "app_current_tenant_id()",
		description: "The tenant the session is bound to (a tenant route, or an API key's tenant), or NULL.",
		definition: sql`CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$;`,
	},
	{
		name: "app_owns",
		signature: "app_owns(text)",
		description: "The OWNERSHIP allow path: the session's user is the row's owner.",
		definition: sql`CREATE OR REPLACE FUNCTION app_owns(owner_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.app_current_user_id() IS NOT NULL AND public.app_current_user_id() = owner_id;
$$;`,
	},
];
