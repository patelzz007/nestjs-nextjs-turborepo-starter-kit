import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
	DatabaseRoleSchema,
	SYSTEM_OPERATIONS,
	SystemOperationSchema,
	isAllowlistedSystemOperation,
	parseSystemOperation,
	SystemOperationNotAllowlistedError,
} from "../system-operation.registry";

const API_ROOT: string = resolve(import.meta.dirname, "..", "..", "..");
const SOURCE_ROOT: string = join(API_ROOT, "src");
const REGISTRY_FILE: string = join(SOURCE_ROOT, "prisma", "system-operation.registry.ts");
/** The allowlist itself: naming an operation there is its definition, not a use. */
const NAMES_FILE: string = join(SOURCE_ROOT, "platform", "application", "system-operation-names.ts");

/** Every non-test TypeScript file under `src/`, except the registry and the name list. */
function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry: string): string[] => {
		const path: string = join(directory, entry);
		if (statSync(path).isDirectory()) {
			return sourceFiles(path);
		}
		return path.endsWith(".ts") && !path.endsWith(".spec.ts") && path !== REGISTRY_FILE && path !== NAMES_FILE ? [path] : [];
	});
}

describe("system-operation registry", () => {
	it("defines every allowlisted name exactly once", () => {
		expect(Object.keys(SYSTEM_OPERATIONS).sort()).toEqual([...SystemOperationSchema.options].sort());
	});

	it("has no dead entries: every operation is used by application code", () => {
		const source: string = sourceFiles(SOURCE_ROOT)
			.map((path: string): string => readFileSync(path, "utf8"))
			.join("\n");
		const unused: string[] = SystemOperationSchema.options.filter((name: string): boolean => !source.includes(`"${name}"`));

		expect(unused).toEqual([]);
	});

	it("names one narrow purpose per operation (no catch-all names)", () => {
		const catchAll: readonly string[] = ["organization.provision", "auth.pre_login", "queue.job", "scheduled.maintenance", "organization.membership.invite"];

		for (const name of catchAll) {
			expect(isAllowlistedSystemOperation(name)).toBe(false);
		}
	});

	it("runs every operation as a role that the RLS bundle creates and grants", () => {
		const helpers: string = readFileSync(join(API_ROOT, "prisma", "rls", "00-app-helpers.sql"), "utf8");
		const grants: string = readFileSync(join(API_ROOT, "prisma", "rls", "99-app-runtime-grants.sql"), "utf8");

		for (const role of DatabaseRoleSchema.options) {
			expect(helpers).toMatch(new RegExp(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS`));
			expect(grants).toContain(role);
		}
		for (const definition of Object.values(SYSTEM_OPERATIONS)) {
			expect(DatabaseRoleSchema.options).toContain(definition.role);
		}
	});

	it("parses allowlisted names and rejects everything else", () => {
		expect(parseSystemOperation("tenant.enumerate")).toBe("tenant.enumerate");
		expect(() => parseSystemOperation("arbitrary.bypass")).toThrow(SystemOperationNotAllowlistedError);
		expect(isAllowlistedSystemOperation("")).toBe(false);
	});

	it("gives the cross-tenant enumerator its read-only role", () => {
		expect(SYSTEM_OPERATIONS["tenant.enumerate"].role).toBe("app_enumerator");
	});

	it("scopes the platform's own plumbing to the tables it maintains", () => {
		expect(SYSTEM_OPERATIONS["outbox.publish"].scope).toEqual({ kind: "tables", tables: ["OutboxEvent"] });
		expect(SYSTEM_OPERATIONS["http.idempotency"].scope).toEqual({ kind: "tables", tables: ["PlatformResourceIdempotencyRecord"] });
		expect(SYSTEM_OPERATIONS["maintenance.authorization_change_sweep"].scope).toEqual({ kind: "tables", tables: ["User"] });
		expect(SYSTEM_OPERATIONS["tenant.enumerate"].scope).toEqual({ kind: "tables", tables: ["Organization"] });
	});

	it("declares a non-empty table list for every table-scoped operation", () => {
		const empty: string[] = Object.entries(SYSTEM_OPERATIONS)
			.filter(([, definition]): boolean => definition.scope.kind === "tables" && definition.scope.tables.length === 0)
			.map(([name]): string => name);

		expect(empty).toEqual([]);
	});

	it("keeps every-table bypass to the request-wide scopes and the operations not narrowed yet — widening one is a visible change here", () => {
		const requestScopes: string[] = Object.entries(SYSTEM_OPERATIONS)
			.filter(([, definition]): boolean => definition.scope.kind === "allTables" && definition.scope.reason === "request_scope")
			.map(([name]): string => name)
			.sort();

		expect(requestScopes).toEqual(["platform.staff_single_tenant", "platform.superadmin", "request.pre_handler", "route.rls_bypass"]);
		for (const [name, definition] of Object.entries(SYSTEM_OPERATIONS)) {
			if (name.startsWith("outbox.") || name.startsWith("audit.") || name.startsWith("encryption.") || name.startsWith("github.webhook.")) {
				expect({ name, kind: definition.scope.kind }).toEqual({ name, kind: "tables" });
			}
		}
	});
});
