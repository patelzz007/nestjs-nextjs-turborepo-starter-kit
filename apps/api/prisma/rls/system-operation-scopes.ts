/**
 * Per-table scope of every system operation's RLS bypass (ADR 012) — rendered from the registry.
 *
 * A system operation used to bypass RLS on every table. Now each policy admits one only through
 * `app_rls_bypass_on('<its own table>')`, which this module renders from `SYSTEM_OPERATIONS[op].scope`
 * (src/prisma/system-operation.registry.ts) into `prisma/rls/00-system-operation-scopes.sql`:
 *
 *   app_rls_bypass_on(table) = app_rls_bypass() AND <the session's operation lists that table>
 *
 * The SQL file is committed (a scope change shows up as a reviewable diff of the database's
 * enforcement) and `system-operation-scopes.spec.ts` fails when it no longer matches the registry.
 * Regenerate with `pnpm --filter @workspace/api db:generate-system-operation-scopes`.
 */

/** The registry's view this module needs: each operation's table scope. */
export type ScopedOperations = Readonly<
	Record<string, { readonly scope: { readonly kind: "tables"; readonly tables: readonly string[] } | { readonly kind: "allTables"; readonly reason: string } }>
>;

/** Where the rendered SQL lives (apps/api-relative), applied right after `00-app-helpers.sql`. */
export const SYSTEM_OPERATION_SCOPES_SQL_PATH = "prisma/rls/00-system-operation-scopes.sql";

/** Operation names and table names are interpolated as SQL literals: only these shapes are accepted. */
const SAFE_OPERATION = /^[a-z_]+(?:\.[a-z_]+)+$/;
const SAFE_TABLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Thrown when the registry names a table the RLS manifest does not know, or an unsafe identifier. */
export class SystemOperationScopeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "SystemOperationScopeError";
	}
}

/** Every `operation → table` the registry declares that is not a known table, as `op: table`. */
export function findUnknownScopeTables(operations: ScopedOperations, knownTables: ReadonlySet<string>): string[] {
	return Object.entries(operations).flatMap(([operation, definition]): string[] =>
		definition.scope.kind === "tables"
			? definition.scope.tables.filter((table: string): boolean => !knownTables.has(table)).map((table: string): string => `${operation}: ${table}`)
			: [],
	);
}

function caseBranch(operation: string, scope: ScopedOperations[string]["scope"]): string {
	if (!SAFE_OPERATION.test(operation)) {
		throw new SystemOperationScopeError(`Unsafe system operation name: ${operation}`);
	}
	if (scope.kind === "allTables") {
		return `    WHEN '${operation}' THEN true -- every table: ${scope.reason}`;
	}
	const unsafe: string | undefined = scope.tables.find((table: string): boolean => !SAFE_TABLE.test(table));
	if (unsafe !== undefined) {
		throw new SystemOperationScopeError(`Unsafe table name in ${operation}: ${unsafe}`);
	}
	const tables: string = [...new Set(scope.tables)]
		.sort((a: string, b: string): number => a.localeCompare(b))
		.map((table: string): string => `'${table}'`)
		.join(", ");
	return `    WHEN '${operation}' THEN table_name IN (${tables})`;
}

/**
 * The SQL of `prisma/rls/00-system-operation-scopes.sql`: `app_rls_bypass_on(table_name)` with one CASE
 * branch per operation, in name order. An operation the registry does not list matches no branch and
 * bypasses nothing — a stray `app.system_operation` value can never widen access.
 */
export function buildSystemOperationScopesSql(operations: ScopedOperations, knownTables: ReadonlySet<string>): string {
	const unknown: string[] = findUnknownScopeTables(operations, knownTables);
	if (unknown.length > 0) {
		throw new SystemOperationScopeError(`System operation scopes name tables the RLS manifest does not know: ${unknown.join(", ")}`);
	}
	const branches: string = Object.entries(operations)
		.sort(([a], [b]): number => a.localeCompare(b))
		.map(([operation, definition]): string => caseBranch(operation, definition.scope))
		.join("\n");
	return `-- ============================================================================
-- GENERATED from src/prisma/system-operation.registry.ts by
-- prisma/rls/system-operation-scopes.ts — do not edit by hand.
-- Regenerate: pnpm --filter @workspace/api db:generate-system-operation-scopes
-- ============================================================================
-- Which tables each allowlisted system operation's RLS bypass reaches (ADR 012).
-- Every policy admits a system operation only through
-- \`(SELECT app_rls_bypass_on('<its table>'))\`: the session must ask for a
-- bypass, name its operation, and that operation must list the table.
-- An unlisted operation matches no branch and bypasses nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_rls_bypass_on(table_name text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass() AND CASE app_system_operation()
${branches}
    ELSE false
  END;
$$;

COMMENT ON FUNCTION app_rls_bypass_on(text) IS
  'ADR 012: true only when the session runs an allowlisted system operation whose registry scope lists table_name.';
`;
}
