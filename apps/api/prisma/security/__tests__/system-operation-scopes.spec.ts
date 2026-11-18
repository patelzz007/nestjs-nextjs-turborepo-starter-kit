import { describe, expect, it } from "vitest";

import { SYSTEM_OPERATIONS } from "../../../src/prisma/system-operation.registry";
import { listAllManifestTables } from "../manifest-index";
import { buildSystemOperationScopesSql, findUnknownScopeTables, SystemOperationScopeError, type ScopedOperations } from "../system-operation-scopes";

const KNOWN: ReadonlySet<string> = new Set(["OutboxEvent", "User", "AuditLog"]);

// That the committed prisma/rls/02-functions.sql carries the registry's current scopes: generated-sql.spec.ts.
describe("system-operation scopes", () => {
	it("is the CREATE OR REPLACE FUNCTION statement and its comment, nothing else", () => {
		const sql: string = buildSystemOperationScopesSql({ "outbox.publish": { scope: { kind: "tables", tables: ["OutboxEvent"] } } }, KNOWN);

		expect(sql.startsWith("CREATE OR REPLACE FUNCTION app_rls_bypass_on(table_name text) RETURNS boolean")).toBe(true);
		expect(sql.endsWith("whose registry scope lists table_name.';")).toBe(true);
	});

	it("renders one branch per operation: its tables, or none for an operation that runs no SQL", () => {
		const operations: ScopedOperations = {
			"outbox.publish": { scope: { kind: "tables", tables: ["OutboxEvent"] } },
			"audit.trail.read": { scope: { kind: "tables", tables: ["User", "AuditLog", "User"] } },
			"queue.storage.delete": { scope: { kind: "tables", tables: [] } },
		};

		const sql: string = buildSystemOperationScopesSql(operations, KNOWN);

		expect(sql).toContain("WHEN 'outbox.publish' THEN table_name IN ('OutboxEvent')");
		expect(sql).toContain("WHEN 'audit.trail.read' THEN table_name IN ('AuditLog', 'User')");
		expect(sql).toContain("WHEN 'queue.storage.delete' THEN false -- no tables");
		expect(sql).not.toContain("THEN true");
		expect(sql.indexOf("'audit.trail.read'")).toBeLessThan(sql.indexOf("'outbox.publish'"));
	});

	it("gives an operation the registry does not list no bypass at all", () => {
		const sql: string = buildSystemOperationScopesSql({ "outbox.publish": { scope: { kind: "tables", tables: ["OutboxEvent"] } } }, KNOWN);

		expect(sql).toMatch(/ELSE false\s+END;/);
		expect(sql).toContain("SELECT public.app_rls_bypass() AND CASE public.app_system_operation()");
	});

	it("refuses a table the RLS manifest does not know, naming the operation", () => {
		const operations: ScopedOperations = { "outbox.publish": { scope: { kind: "tables", tables: ["OutboxEvent", "outbox_typo"] } } };

		expect(findUnknownScopeTables(operations, KNOWN)).toEqual(["outbox.publish: outbox_typo"]);
		expect((): string => buildSystemOperationScopesSql(operations, KNOWN)).toThrow(SystemOperationScopeError);
	});

	it("refuses names that are not safe to inline as SQL literals", () => {
		expect((): string => buildSystemOperationScopesSql({ "x'; DROP TABLE users; --.y": { scope: { kind: "tables", tables: ["User"] } } }, KNOWN)).toThrow(
			SystemOperationScopeError,
		);
		expect((): string => buildSystemOperationScopesSql({ "outbox.publish": { scope: { kind: "tables", tables: ["users'"] } } }, new Set(["users'"]))).toThrow(
			SystemOperationScopeError,
		);
	});

	it("names only tables the RLS manifest knows in the shipped registry", () => {
		expect(findUnknownScopeTables(SYSTEM_OPERATIONS, new Set(listAllManifestTables()))).toEqual([]);
	});
});
