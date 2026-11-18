import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * RLS apply plan — the order the generated security SQL runs in (paths relative to `apps/api`).
 *
 * Every file is GENERATED from the TypeScript in prisma/security (generator/index.ts); none is edited by
 * hand. A file may only call helpers and roles created at or above its own layer:
 *
 * 1. `01-roles.sql`      — the roles every later file grants to or names in a policy
 * 2. `02-functions.sql`  — the session primitives, the scoped bypass, the access model, trigger functions
 * 3. `03-triggers.sql`   — the hand-picked triggers (call trigger functions)
 * 4. `04-policies.sql`   — RLS enabled and forced on every table, every policy (call the helpers)
 * 5. `05-grants.sql`     — each role's privileges over everything above (must run last: apply.ts appends
 *                          the withheld app_runtime REVOKEs to its transaction)
 *
 * The plan is validated before anything touches the database:
 * - every listed file must exist, and every `*.sql` on disk must be listed (a stray hand-written file in
 *   prisma/rls fails here);
 * - every `app_*()` call must appear at or after the file that defines it, so a helper used before its
 *   definition fails HERE instead of against a fresh database;
 * - each helper may be defined in exactly one file, and each role used only after it is created.
 *
 * `pnpm db:apply-security` applies this plan; `pnpm tools db:check-rls-manifest` runs the same validation
 * so violations fail in CI too.
 */
export const RLS_APPLY_ORDER: readonly string[] = [
	"prisma/rls/01-roles.sql",
	"prisma/rls/02-functions.sql",
	"prisma/rls/03-triggers.sql",
	"prisma/rls/04-policies.sql",
	"prisma/rls/05-grants.sql",
];

/** One SQL file in the plan. `path` is the apiDir-relative path shown in errors. */
export interface RlsPlanFile {
	readonly path: string;
	readonly sql: string;
}

/** `CREATE [OR REPLACE] FUNCTION [schema.]name(` — records where a helper is defined. */
const HELPER_DEFINE_PATTERN = /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:[a-z_][a-z0-9_]*\.)?(?<name>[a-z_][a-z0-9_]*)\s*\(/gi;

/** Any `app_*(` call — the RLS helper namespace (policies, function bodies, GRANTs). */
const HELPER_CALL_PATTERN = /\bapp_[a-z0-9_]+\s*\(/g;

/** `CREATE ROLE name` — records where a role is created. */
const ROLE_DEFINE_PATTERN = /\bCREATE\s+ROLE\s+(?<name>[a-z_][a-z0-9_]*)/gi;

interface RoleToken {
	readonly kind: "define" | "use";
	readonly name: string;
	readonly offset: number;
}

interface HelperToken {
	readonly kind: "define" | "use";
	readonly name: string;
	readonly offset: number;
}

function lineOf(sql: string, offset: number): number {
	return sql.slice(0, offset).split("\n").length;
}

/**
 * Replaces SQL comments with spaces so their text can never be mistaken for a
 * dependency (e.g. a header comment mentioning `app_owns()`). Length- and
 * newline-preserving: token offsets and line numbers stay valid. Single-quoted
 * strings and dollar-quoted bodies (`$$ … $$`) are kept verbatim.
 */
export function stripSqlComments(sql: string): string {
	const out = sql.split("");
	let i = 0;

	const blank = (from: number, to: number): void => {
		for (let j = from; j < to && j < out.length; j += 1) {
			if (out[j] !== "\n") {
				out[j] = " ";
			}
		}
	};

	while (i < sql.length) {
		const char = sql[i];

		if (char === "'") {
			// Single-quoted string — keep verbatim ('' escapes a quote).
			i += 1;
			while (i < sql.length) {
				if (sql[i] === "'") {
					if (sql[i + 1] === "'") {
						i += 2;
						continue;
					}
					i += 1;
					break;
				}
				i += 1;
			}
			continue;
		}

		// Dollar-quoted body ($$ … $$ or $tag$ … $tag$) — keep verbatim.
		const dollar = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i, i + 64));
		if (dollar !== null) {
			const [tag] = dollar;
			const close = sql.indexOf(tag, i + tag.length);
			i = close === -1 ? sql.length : close + tag.length;
			continue;
		}

		if (char === "-" && sql[i + 1] === "-") {
			let end = i;
			while (end < sql.length && sql[end] !== "\n") {
				end += 1;
			}
			blank(i, end);
			i = end;
			continue;
		}

		if (char === "/" && sql[i + 1] === "*") {
			const close = sql.indexOf("*/", i + 2);
			const end = close === -1 ? sql.length : close + 2;
			blank(i, end);
			i = end;
			continue;
		}

		i += 1;
	}

	return out.join("");
}

function collectHelperTokens(sql: string): HelperToken[] {
	const code = stripSqlComments(sql);
	const tokens: HelperToken[] = [];

	for (const match of code.matchAll(HELPER_DEFINE_PATTERN)) {
		const helperName = match.groups?.name;
		if (helperName !== undefined) {
			tokens.push({ kind: "define", name: helperName.toLowerCase(), offset: match.index });
		}
	}

	for (const match of code.matchAll(HELPER_CALL_PATTERN)) {
		const [call] = match;
		tokens.push({ kind: "use", name: call.replace("(", "").toLowerCase(), offset: match.index });
	}

	// At the same offset (a `CREATE FUNCTION app_foo(` header matches both
	// patterns) the definition wins, so a file may define a helper and call it.
	return tokens.sort((a: HelperToken, b: HelperToken): number => a.offset - b.offset || (a.kind === "define" ? -1 : 1));
}

/**
 * Asserts every `app_*()` call happens at or after the point its helper is
 * defined, walking the plan in apply order. Mirrors PostgreSQL: SQL function
 * bodies and policies are validated when created, so a helper referenced by an
 * earlier file cannot exist on a fresh database.
 */
export function assertRlsHelperDependencies(files: readonly RlsPlanFile[]): void {
	const definedBy = new Map<string, string>();

	for (const file of files) {
		for (const token of collectHelperTokens(file.sql)) {
			if (token.kind === "define") {
				const existing = definedBy.get(token.name);
				if (existing !== undefined && existing !== file.path) {
					throw new Error(`${file.path} redefines ${token.name}() — already defined in ${existing}. Each helper must be defined in exactly one file.`);
				}
				definedBy.set(token.name, file.path);
				continue;
			}

			if (!definedBy.has(token.name)) {
				const laterDefiner = files
					.slice(files.indexOf(file) + 1)
					.find((later: RlsPlanFile): boolean => collectHelperTokens(later.sql).some((t: HelperToken): boolean => t.kind === "define" && t.name === token.name));
				const where = laterDefiner === undefined ? "no file in RLS_APPLY_ORDER" : laterDefiner.path;
				throw new Error(
					`${file.path} uses ${token.name}() at line ${String(lineOf(file.sql, token.offset))} before it is defined (defined in: ${where}). ` +
						`A fresh database applies files in RLS_APPLY_ORDER order and would fail here. Define the function earlier (prisma/security/generator/functions/index.ts) and regenerate.`,
				);
			}
		}
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Role tokens in one file: `CREATE ROLE x` definitions and bare references to
 * any role in `roleNames` (GRANT … TO x, SET ROLE x, …). Comments are ignored;
 * a quoted mention such as `rolname = 'x'` (the existence check guarding a
 * CREATE ROLE) is not a use.
 */
function collectRoleTokens(sql: string, roleNames: ReadonlySet<string>): RoleToken[] {
	const code = stripSqlComments(sql);
	const tokens: RoleToken[] = [];
	const definitionOffsets = new Set<number>();

	for (const match of code.matchAll(ROLE_DEFINE_PATTERN)) {
		const rawName = match.groups?.name;
		if (rawName === undefined) {
			continue;
		}
		const name = rawName.toLowerCase();
		const [definition] = match;
		const nameOffset = match.index + definition.length - name.length;
		definitionOffsets.add(nameOffset);
		tokens.push({ kind: "define", name, offset: match.index });
	}

	for (const role of roleNames) {
		const usePattern = new RegExp(`(?<![\\w'"])${escapeRegExp(role)}(?![\\w'"])`, "gi");
		for (const match of code.matchAll(usePattern)) {
			if (!definitionOffsets.has(match.index)) {
				tokens.push({ kind: "use", name: role, offset: match.index });
			}
		}
	}

	return tokens.sort((a: RoleToken, b: RoleToken): number => a.offset - b.offset || (a.kind === "define" ? -1 : 1));
}

/**
 * Asserts every role the plan creates is referenced only at or after its
 * `CREATE ROLE`, walking files in apply order, and is created in exactly one
 * file. On a fresh cluster a GRANT to a not-yet-created role aborts the apply
 * with `role "…" does not exist` (roles are cluster-wide, so long-lived dev
 * clusters never notice).
 */
export function assertRlsRoleDependencies(files: readonly RlsPlanFile[]): void {
	const roleNames = new Set<string>();
	for (const file of files) {
		for (const match of stripSqlComments(file.sql).matchAll(ROLE_DEFINE_PATTERN)) {
			const roleName = match.groups?.name;
			if (roleName !== undefined) {
				roleNames.add(roleName.toLowerCase());
			}
		}
	}

	const createdBy = new Map<string, string>();
	for (const file of files) {
		for (const token of collectRoleTokens(file.sql, roleNames)) {
			if (token.kind === "define") {
				const existing = createdBy.get(token.name);
				if (existing !== undefined && existing !== file.path) {
					throw new Error(`${file.path} creates role ${token.name} — already created in ${existing}. Each role must be created in exactly one file.`);
				}
				createdBy.set(token.name, file.path);
				continue;
			}
			if (!createdBy.has(token.name)) {
				throw new Error(
					`${file.path} uses role ${token.name} at line ${String(lineOf(file.sql, token.offset))} before it is created. ` +
						`A fresh cluster applies files in RLS_APPLY_ORDER order and would fail here. Declare the role in prisma/security/roles.ts and regenerate.`,
				);
			}
		}
	}
}

/** Asserts the registered plan and the files on disk are the same set. */
export function assertPlanMatchesDisk(order: readonly string[], diskFiles: readonly string[]): void {
	const orderSet = new Set(order);
	const diskSet = new Set(diskFiles);

	const notOnDisk = order.filter((path: string): boolean => !diskSet.has(path));
	if (notOnDisk.length > 0) {
		throw new Error(`RLS_APPLY_ORDER lists files that do not exist: ${notOnDisk.join(", ")}. Generate them: pnpm --filter @workspace/api db:generate-security.`);
	}

	const notInOrder = diskFiles.filter((path: string): boolean => !orderSet.has(path));
	if (notInOrder.length > 0) {
		throw new Error(
			`SQL files in prisma/rls that the generator does not write: ${notInOrder.join(", ")}. prisma/rls holds only generated SQL — move what they do into the TypeScript in prisma/security and delete them.`,
		);
	}
}

/**
 * Builds the validated apply plan for an apiDir: checks disk drift, then the
 * helper and role dependency order, and returns the absolute file paths in apply order.
 * Throws before any SQL runs if either check fails.
 */
export function buildRlsApplyPlan(apiDir: string): string[] {
	const fragmentsDir = resolve(apiDir, "prisma", "rls");

	const diskFiles: string[] = [];
	if (existsSync(fragmentsDir)) {
		const fragments = readdirSync(fragmentsDir)
			.filter((name: string): boolean => name.endsWith(".sql"))
			.sort((a: string, b: string): number => a.localeCompare(b))
			.map((name: string): string => `prisma/rls/${name}`);
		diskFiles.push(...fragments);
	}

	assertPlanMatchesDisk(RLS_APPLY_ORDER, diskFiles);

	const files: RlsPlanFile[] = RLS_APPLY_ORDER.map((path: string): RlsPlanFile => ({ path, sql: readFileSync(resolve(apiDir, path), "utf8") }));
	assertRlsHelperDependencies(files);
	assertRlsRoleDependencies(files);

	return RLS_APPLY_ORDER.map((path: string): string => resolve(apiDir, path));
}
