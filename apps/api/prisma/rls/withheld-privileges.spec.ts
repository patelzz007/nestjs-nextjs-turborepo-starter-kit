import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { stripSqlComments } from "../../scripts/rls-apply-plan";
import { parsePrismaSchemaModels } from "./manifest-index";
import {
	APP_RUNTIME_WITHHELD_PRIVILEGES,
	buildWithheldPrivilegeRevocationSql,
	findHandWrittenAppRuntimeRevokes,
	findUnknownWithheldPrivilegeTables,
	listWithheldPrivileges,
	WithheldPrivilegeDeclarationError,
} from "./withheld-privileges";

const prismaDir = resolve(import.meta.dirname, "..");

function readRlsSql(): string {
	const fragments = readdirSync(resolve(prismaDir, "rls"))
		.filter((name: string) => name.endsWith(".sql"))
		.map((name: string) => readFileSync(resolve(prismaDir, "rls", name), "utf8"));
	return [readFileSync(resolve(prismaDir, "rls.sql"), "utf8"), ...fragments].join("\n");
}

describe("withheld app_runtime privileges", () => {
	it("keeps every append-only audit trail append-only", () => {
		for (const table of ["audit_logs", "impersonation_audit_logs", "mfa_recovery_audit_logs"]) {
			expect(APP_RUNTIME_WITHHELD_PRIVILEGES[table]).toEqual(["UPDATE", "DELETE"]);
		}
	});

	it("generates one REVOKE per table, in a stable order, for the application role", () => {
		const sql = buildWithheldPrivilegeRevocationSql([
			{ table: "impersonation_sessions", privileges: ["DELETE"] },
			{ table: "audit_logs", privileges: ["UPDATE", "DELETE", "UPDATE"] },
		]);

		expect(sql.split("\n").slice(1)).toEqual([
			"REVOKE DELETE ON TABLE public.impersonation_sessions FROM app_runtime;",
			"REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM app_runtime;",
		]);
		expect(listWithheldPrivileges({ b_table: ["DELETE"], a_table: ["UPDATE"] }).map((entry) => entry.table)).toEqual(["a_table", "b_table"]);
	});

	it("refuses to interpolate an unsafe identifier or an entry without privileges", () => {
		expect(() => buildWithheldPrivilegeRevocationSql([{ table: "audit_logs; DROP TABLE users", privileges: ["DELETE"] }])).toThrow(WithheldPrivilegeDeclarationError);
		expect(() => buildWithheldPrivilegeRevocationSql([{ table: "audit_logs", privileges: [] }])).toThrow(WithheldPrivilegeDeclarationError);
		expect(() => buildWithheldPrivilegeRevocationSql([], "app_runtime; --")).toThrow(WithheldPrivilegeDeclarationError);
	});

	it("names only tables that exist in schema.prisma", () => {
		const prismaTables = new Set(parsePrismaSchemaModels(readFileSync(resolve(prismaDir, "schema.prisma"), "utf8")).map((model) => model.tableName));

		expect(findUnknownWithheldPrivilegeTables(listWithheldPrivileges(), prismaTables)).toEqual([]);
		expect(findUnknownWithheldPrivilegeTables([{ table: "no_such_table", privileges: ["DELETE"] }], prismaTables)).toEqual(["no_such_table"]);
	});

	it("detects hand-written table REVOKEs from app_runtime (they are undone by the blanket grant)", () => {
		expect(findHandWrittenAppRuntimeRevokes("REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM app_runtime;")).toHaveLength(1);
		expect(findHandWrittenAppRuntimeRevokes("REVOKE DELETE ON TABLE public.regions, public.cities FROM app_runtime;")).toHaveLength(1);
		expect(findHandWrittenAppRuntimeRevokes("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_enumerator;")).toEqual([]);
	});

	it("has no hand-written REVOKE … FROM app_runtime left in the RLS SQL", () => {
		expect(findHandWrittenAppRuntimeRevokes(stripSqlComments(readRlsSql()))).toEqual([]);
	});
});
