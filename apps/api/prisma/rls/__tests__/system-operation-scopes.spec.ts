import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SYSTEM_OPERATIONS } from "../../../src/prisma/system-operation.registry";
import { listAllManifestTables } from "../manifest-index";
import {
	buildSystemOperationScopesSql,
	findUnknownScopeTables,
	SYSTEM_OPERATION_SCOPES_SQL_PATH,
	SystemOperationScopeError,
	type ScopedOperations,
} from "../system-operation-scopes";

const apiDir = resolve(import.meta.dirname, "..", "..", "..");
const KNOWN: ReadonlySet<string> = new Set(["OutboxEvent", "User", "AuditLog"]);

describe("system-operation scopes", () => {
	it("matches the committed SQL — regenerate with `pnpm db:generate-system-operation-scopes` after a registry change", () => {
		const committed: string = readFileSync(resolve(apiDir, SYSTEM_OPERATION_SCOPES_SQL_PATH), "utf8");

		expect(committed).toBe(buildSystemOperationScopesSql(SYSTEM_OPERATIONS, new Set(listAllManifestTables())));
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
		expect(sql).toContain("SELECT app_rls_bypass() AND CASE app_system_operation()");
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
