/**
 * Table privileges WITHHELD from `app_runtime` — the single declared list.
 *
 * `99-app-runtime-grants.sql` grants SELECT/INSERT/UPDATE/DELETE on EVERY
 * table to `app_runtime` (so tables created by later migrations work), which
 * would silently undo any per-table REVOKE written earlier in the RLS bundle.
 * Instead, every table that must stay append-only (audit trails) or
 * never-deleted (soft-delete-only data, ended sessions) is declared HERE.
 * `scripts/apply-rls.ts` appends the generated REVOKEs to the grants file in
 * the SAME transaction (no window where the privilege is back), then verifies
 * against the live catalog that the role really lacks each privilege.
 * `db:check-rls-manifest` fails when an entry names an unknown table.
 *
 * Adding a table is a one-line change here — do not hand-write REVOKEs for
 * `app_runtime` in the SQL files.
 */

/** A table privilege that may be withheld from the application role. */
export type WithheldPrivilege = "UPDATE" | "DELETE";

/** The application role the blanket grant targets. */
export const APP_RUNTIME_ROLE = "app_runtime";

const APPEND_ONLY: readonly WithheldPrivilege[] = ["UPDATE", "DELETE"];
const NEVER_DELETED: readonly WithheldPrivilege[] = ["DELETE"];

export const APP_RUNTIME_WITHHELD_PRIVILEGES: Readonly<Record<string, readonly WithheldPrivilege[]>> = {
	// ── Append-only audit trails (rules/10 → "Storage and immutability") ──
	audit_logs: APPEND_ONLY,
	impersonation_audit_logs: APPEND_ONLY,
	mfa_recovery_audit_logs: APPEND_ONLY,
	// ── Never deleted: ended via `ended_at`, kept as forensic record ──
	impersonation_sessions: NEVER_DELETED,
	// ── Geo reference data: soft-deleted, never hard-deleted ──
	regions: NEVER_DELETED,
	subregions: NEVER_DELETED,
	countries: NEVER_DELETED,
	states: NEVER_DELETED,
	cities: NEVER_DELETED,
};

/** A PostgreSQL identifier this module will interpolate (lower-case snake case only). */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** One table and the privileges withheld on it. */
export interface WithheldPrivilegeEntry {
	readonly table: string;
	readonly privileges: readonly WithheldPrivilege[];
}

/** The declared entries in a stable (alphabetical) order. */
export function listWithheldPrivileges(declared: Readonly<Record<string, readonly WithheldPrivilege[]>> = APP_RUNTIME_WITHHELD_PRIVILEGES): WithheldPrivilegeEntry[] {
	return Object.entries(declared)
		.map(([table, privileges]: [string, readonly WithheldPrivilege[]]): WithheldPrivilegeEntry => ({ table, privileges }))
		.sort((left: WithheldPrivilegeEntry, right: WithheldPrivilegeEntry) => left.table.localeCompare(right.table));
}

/** Thrown when a declared entry cannot be turned into safe SQL. */
export class WithheldPrivilegeDeclarationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "WithheldPrivilegeDeclarationError";
	}
}

/**
 * The REVOKE statements for `entries` — appended after the blanket grant.
 * Rejects identifiers that are not plain snake case and entries without a
 * privilege, so nothing unvalidated is ever interpolated into SQL.
 */
export function buildWithheldPrivilegeRevocationSql(entries: readonly WithheldPrivilegeEntry[], role: string = APP_RUNTIME_ROLE): string {
	if (!SAFE_IDENTIFIER.test(role)) {
		throw new WithheldPrivilegeDeclarationError(`Unsafe role identifier: ${role}`);
	}
	const statements: string[] = entries.map((entry: WithheldPrivilegeEntry): string => {
		if (!SAFE_IDENTIFIER.test(entry.table)) {
			throw new WithheldPrivilegeDeclarationError(`Unsafe table identifier: ${entry.table}`);
		}
		if (entry.privileges.length === 0) {
			throw new WithheldPrivilegeDeclarationError(`No privilege declared for ${entry.table}`);
		}
		return `REVOKE ${[...new Set(entry.privileges)].join(", ")} ON TABLE public.${entry.table} FROM ${role};`;
	});
	return ["-- Generated from prisma/rls/withheld-privileges.ts (APP_RUNTIME_WITHHELD_PRIVILEGES)", ...statements].join("\n");
}

/** Declared tables that are not Prisma tables (typo, renamed or dropped table) — each is a manifest error. */
export function findUnknownWithheldPrivilegeTables(entries: readonly WithheldPrivilegeEntry[], prismaTables: ReadonlySet<string>): string[] {
	return entries.filter((entry: WithheldPrivilegeEntry) => !prismaTables.has(entry.table)).map((entry: WithheldPrivilegeEntry) => entry.table);
}

/** A table-level REVOKE from the application role written by hand in the RLS SQL. */
const HAND_WRITTEN_APP_RUNTIME_REVOKE = /^\s*REVOKE\s+[^;]*?\s+ON\s+(?:TABLE\s+)?(?!ALL\s+TABLES)[^;]*?\s+FROM\s+app_runtime\s*;/gim;

/**
 * Hand-written `REVOKE … ON TABLE … FROM app_runtime` statements in the RLS
 * SQL. They are always undone by the blanket grant in `99-app-runtime-grants.sql`,
 * so they give a false sense of protection — the table belongs in
 * {@link APP_RUNTIME_WITHHELD_PRIVILEGES} instead.
 */
export function findHandWrittenAppRuntimeRevokes(rlsSqlWithoutComments: string): string[] {
	return [...rlsSqlWithoutComments.matchAll(HAND_WRITTEN_APP_RUNTIME_REVOKE)].map((match: RegExpMatchArray) => match[0].trim());
}
