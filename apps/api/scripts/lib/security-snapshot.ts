import type { QueryResultRow } from "pg";
import { z } from "zod";

/**
 * `pnpm db:security-snapshot`: everything PostgreSQL holds that decides who may touch what — policies,
 * functions, triggers, roles, role memberships, privileges and each table's row-level-security state —
 * read from the catalog into one sorted JSON document.
 *
 * Two snapshots of fresh databases compare the database's real behaviour, not the SQL text that produced
 * it: Postgres stores a policy as a parse tree and prints it back canonically, so spacing, comments and
 * redundant parentheses never show up as a difference, while a changed condition, role, command, function
 * body, owner, `SECURITY DEFINER` flag, `search_path` or grant always does.
 */

/** The schema every application object lives in. */
export const SNAPSHOT_SCHEMA = "public";

/** A catalog query: what it is called in the snapshot, the SQL, and the columns that identify one row. */
export interface SnapshotQuery {
	readonly section: SnapshotSection;
	readonly sql: string;
	readonly key: readonly string[];
}

export const SnapshotSectionSchema = z.enum(["policies", "functions", "triggers", "relations", "columnPrivileges", "schema", "defaultPrivileges", "roles", "memberships"]);
export type SnapshotSection = z.output<typeof SnapshotSectionSchema>;

/** A sorted aclitem[] as text, or NULL when the object still has its built-in default privileges. */
function sortedAcl(column: string): string {
	return `CASE WHEN ${column} IS NULL THEN NULL ELSE (SELECT array_agg(item::text ORDER BY item::text) FROM unnest(${column}) AS item) END`;
}

/** Roles PostgreSQL creates itself (`pg_*`) are the same on every server and never part of a snapshot. */
const APPLICATION_ROLES = "rolname !~ '^pg_'";

export const SNAPSHOT_QUERIES: readonly SnapshotQuery[] = [
	{
		section: "policies",
		key: ["table", "name"],
		sql: `SELECT tablename::text AS "table", policyname::text AS name, permissive, roles::text[] AS roles, cmd AS command, qual AS "using", with_check AS "withCheck"
FROM pg_catalog.pg_policies WHERE schemaname = '${SNAPSHOT_SCHEMA}'`,
	},
	{
		section: "functions",
		key: ["name", "arguments"],
		sql: `SELECT p.proname::text AS name, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments, pg_catalog.pg_get_function_result(p.oid) AS result,
  l.lanname::text AS language, p.prosrc AS body, p.prosecdef AS "securityDefiner", p.provolatile::text AS volatility,
  COALESCE(p.proconfig, ARRAY[]::text[]) AS settings, pg_catalog.pg_get_userbyid(p.proowner)::text AS owner,
  ${sortedAcl("p.proacl")} AS acl, pg_catalog.obj_description(p.oid, 'pg_proc') AS comment
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = '${SNAPSHOT_SCHEMA}'`,
	},
	{
		section: "triggers",
		key: ["table", "name"],
		sql: `SELECT c.relname::text AS "table", t.tgname::text AS name, pg_catalog.pg_get_triggerdef(t.oid) AS definition, t.tgenabled::text AS enabled
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${SNAPSHOT_SCHEMA}' AND NOT t.tgisinternal`,
	},
	{
		section: "relations",
		key: ["name"],
		sql: `SELECT c.relname::text AS name, c.relkind::text AS kind, c.relrowsecurity AS "rlsEnabled", c.relforcerowsecurity AS "rlsForced",
  pg_catalog.pg_get_userbyid(c.relowner)::text AS owner, ${sortedAcl("c.relacl")} AS acl
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${SNAPSHOT_SCHEMA}' AND c.relkind IN ('r', 'p', 'S', 'v', 'm')`,
	},
	{
		section: "columnPrivileges",
		key: ["table", "column"],
		sql: `SELECT c.relname::text AS "table", a.attname::text AS "column", ${sortedAcl("a.attacl")} AS acl
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${SNAPSHOT_SCHEMA}' AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL`,
	},
	{
		section: "schema",
		key: ["name"],
		sql: `SELECT nspname::text AS name, pg_catalog.pg_get_userbyid(nspowner)::text AS owner, ${sortedAcl("nspacl")} AS acl
FROM pg_catalog.pg_namespace WHERE nspname = '${SNAPSHOT_SCHEMA}'`,
	},
	{
		section: "defaultPrivileges",
		key: ["role", "schema", "objectType"],
		sql: `SELECT pg_catalog.pg_get_userbyid(d.defaclrole)::text AS role, COALESCE(n.nspname::text, '') AS schema, d.defaclobjtype::text AS "objectType",
  ${sortedAcl("d.defaclacl")} AS acl
FROM pg_catalog.pg_default_acl d
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace`,
	},
	{
		section: "roles",
		key: ["name"],
		sql: `SELECT rolname::text AS name, rolsuper AS superuser, rolinherit AS inherit, rolcreaterole AS "createRole", rolcreatedb AS "createDb",
  rolcanlogin AS "canLogin", rolreplication AS replication, rolbypassrls AS "bypassRls", COALESCE(rolconfig, ARRAY[]::text[]) AS settings
FROM pg_catalog.pg_roles WHERE ${APPLICATION_ROLES}`,
	},
	{
		section: "memberships",
		key: ["role", "member"],
		sql: `SELECT r.rolname::text AS role, m.rolname::text AS member, am.admin_option AS "adminOption", am.inherit_option AS "inheritOption", am.set_option AS "setOption"
FROM pg_catalog.pg_auth_members am
JOIN pg_catalog.pg_roles r ON r.oid = am.roleid
JOIN pg_catalog.pg_roles m ON m.oid = am.member
WHERE r.${APPLICATION_ROLES}`,
	},
];

/** A catalog value: what `pg` returns for the columns the queries select. */
const SnapshotValueSchema = z.union([z.string(), z.boolean(), z.null(), z.array(z.string())]);
export type SnapshotValue = z.output<typeof SnapshotValueSchema>;

export const SnapshotRowSchema = z.record(z.string(), SnapshotValueSchema);
export type SnapshotRow = z.output<typeof SnapshotRowSchema>;

/** Sections a snapshot has (a test may build one with only the sections it compares). */
export const SecuritySnapshotSchema = z.partialRecord(SnapshotSectionSchema, z.array(SnapshotRowSchema));
export type SecuritySnapshot = z.output<typeof SecuritySnapshotSchema>;

/** The text that identifies one row of a section (its key columns joined). */
export function rowKey(row: SnapshotRow, key: readonly string[]): string {
	return key.map((column: string): string => String(row[column] ?? "")).join(" · ");
}

const TextArraySchema = z.array(z.string());

/** A value with its array (if it is one) sorted. */
function sortedValue(value: SnapshotValue): SnapshotValue {
	const list = TextArraySchema.safeParse(value);
	return list.success ? [...list.data].sort((a: string, b: string): number => a.localeCompare(b)) : value;
}

/** One row with every array sorted, so the order PostgreSQL happened to list a policy's roles in never differs. */
export function normalizeRow(row: SnapshotRow): SnapshotRow {
	return Object.fromEntries(
		Object.entries(row)
			.sort(([left], [right]): number => left.localeCompare(right))
			.map(([column, value]): [string, SnapshotValue] => [column, sortedValue(value)]),
	);
}

/** A section's rows, validated, normalized and sorted by key. */
export function normalizeSection(query: SnapshotQuery, rows: readonly QueryResultRow[]): SnapshotRow[] {
	return rows
		.map((row: QueryResultRow): SnapshotRow => normalizeRow(SnapshotRowSchema.parse(row)))
		.sort((left: SnapshotRow, right: SnapshotRow): number => rowKey(left, query.key).localeCompare(rowKey(right, query.key)));
}

/** How one section of two snapshots differs: rows only in the expected one, only in the actual one, or changed. */
export interface SectionDifference {
	readonly section: SnapshotSection;
	readonly missing: readonly string[];
	readonly unexpected: readonly string[];
	readonly changed: readonly { readonly key: string; readonly expected: SnapshotRow; readonly actual: SnapshotRow }[];
}

function keyedRows(rows: readonly SnapshotRow[], key: readonly string[]): Map<string, SnapshotRow> {
	return new Map(rows.map((row: SnapshotRow): [string, SnapshotRow] => [rowKey(row, key), row]));
}

/** Every section in which `actual` differs from `expected`; empty when the two databases enforce the same thing. */
export function diffSnapshots(expected: SecuritySnapshot, actual: SecuritySnapshot, queries: readonly SnapshotQuery[] = SNAPSHOT_QUERIES): SectionDifference[] {
	return queries.flatMap((query: SnapshotQuery): SectionDifference[] => {
		const before = keyedRows(expected[query.section] ?? [], query.key);
		const after = keyedRows(actual[query.section] ?? [], query.key);
		const missing = [...before.keys()].filter((key: string): boolean => !after.has(key));
		const unexpected = [...after.keys()].filter((key: string): boolean => !before.has(key));
		const changed = [...before.entries()].flatMap(([key, row]) => {
			const other = after.get(key);
			return other === undefined || JSON.stringify(other) === JSON.stringify(row) ? [] : [{ key, expected: row, actual: other }];
		});
		return missing.length === 0 && unexpected.length === 0 && changed.length === 0 ? [] : [{ section: query.section, missing, unexpected, changed }];
	});
}

/** Columns of a changed row whose values differ, as `column: expected → actual`. */
function changedColumns(expected: SnapshotRow, actual: SnapshotRow): string[] {
	const columns = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort((a: string, b: string): number => a.localeCompare(b));
	return columns
		.filter((column: string): boolean => JSON.stringify(expected[column] ?? null) !== JSON.stringify(actual[column] ?? null))
		.map((column: string): string => `      ${column}: ${JSON.stringify(expected[column] ?? null)} → ${JSON.stringify(actual[column] ?? null)}`);
}

/** The differences as a readable report; "identical" when there are none. */
export function formatDifferences(differences: readonly SectionDifference[]): string {
	if (differences.length === 0) {
		return "Identical: every policy, function, trigger, role, membership, privilege and RLS flag matches.";
	}
	return differences
		.map((difference: SectionDifference): string =>
			[
				`${difference.section}:`,
				...difference.missing.map((key: string): string => `  - missing: ${key}`),
				...difference.unexpected.map((key: string): string => `  + unexpected: ${key}`),
				...difference.changed.flatMap((change) => [`  ~ changed: ${change.key}`, ...changedColumns(change.expected, change.actual)]),
			].join("\n"),
		)
		.join("\n");
}

/** Reads a snapshot written earlier (a JSON file's text). */
export function parseSnapshot(text: string): SecuritySnapshot {
	return SecuritySnapshotSchema.parse(JSON.parse(text));
}

/** What `db:security-snapshot` was asked to do. */
export interface SnapshotOptions {
	/** Where to write the snapshot. */
	readonly out: string;
	/** A snapshot to compare against: the command fails when the two differ. */
	readonly compare: string | undefined;
	/** A git ref whose `prisma/rls/*.sql` is applied first, as an older release left the database. */
	readonly upgradeFrom: string | undefined;
}

/** The value after `flag` in `args`, if the flag is there. */
function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index === -1 ? undefined : args[index + 1];
}

/** Parses `--out <file> [--compare <file>] [--upgrade-from <git ref>]`; `--out` is required. */
export function parseSnapshotOptions(args: readonly string[]): SnapshotOptions {
	const out = flagValue(args, "--out");
	if (out === undefined || out.startsWith("--")) {
		throw new Error("Usage: db:security-snapshot --out <file.json> [--compare <file.json>] [--upgrade-from <git ref>]");
	}
	return { out, compare: flagValue(args, "--compare"), upgradeFrom: flagValue(args, "--upgrade-from") };
}

/** The `.sql` files of a `git ls-tree --name-only` listing, in name order (the old apply order). */
export function sqlFilesOfListing(listing: string): string[] {
	return listing
		.split("\n")
		.map((line: string): string => line.trim())
		.filter((line: string): boolean => line.endsWith(".sql"))
		.sort((left: string, right: string): number => left.localeCompare(right));
}

/** Spaces per indentation level of a written snapshot. */
const SNAPSHOT_JSON_INDENT = 2;

/** The snapshot as committed JSON: indented, ending in a newline. */
export function serializeSnapshot(snapshot: SecuritySnapshot): string {
	return `${JSON.stringify(snapshot, null, SNAPSHOT_JSON_INDENT)}\n`;
}
