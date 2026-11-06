import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePrismaSchemaModels } from "../manifest-index";
import { STANDARD_POLICIES_PATH, renderStandardPolicies } from "../standard-policies";
import { TABLE_POLICIES } from "../table-policies";

const apiDir = resolve(import.meta.dirname, "..", "..", "..");
const rlsDir = resolve(apiDir, "prisma", "rls");

function handWrittenSql(): string {
	return readdirSync(rlsDir)
		.filter((name) => name.endsWith(".sql") && name !== "97-standard-policies.sql")
		.map((name) => readFileSync(resolve(rlsDir, name), "utf8"))
		.join("\n");
}

describe("the table policy list", () => {
	it("names every table, so a new table cannot go without a decision", () => {
		const models = parsePrismaSchemaModels(readFileSync(resolve(apiDir, "prisma", "schema.prisma"), "utf8")).map((model) => model.tableName);
		expect(models.filter((model) => !(model in TABLE_POLICIES))).toStrictEqual([]);
		expect(Object.keys(TABLE_POLICIES).filter((table) => !models.includes(table))).toStrictEqual([]);
	});

	it("matches the generated SQL (run db:generate-rls-policies)", () => {
		expect(readFileSync(resolve(apiDir, STANDARD_POLICIES_PATH), "utf8")).toBe(renderStandardPolicies());
	});

	it("gives every policy of a table its own name", () => {
		for (const [table, policies] of Object.entries(TABLE_POLICIES)) {
			const names = policies.map((policy) => policy.name);
			expect(new Set(names).size, table).toBe(names.length);
		}
	});

	it("is not also hand-written", () => {
		const sql = handWrittenSql();
		const repeated = Object.entries(TABLE_POLICIES).flatMap(([table, policies]) =>
			policies.filter((policy) => sql.includes(`CREATE POLICY ${policy.name} ON public."${table}"`)).map((policy) => policy.name),
		);
		expect(repeated).toStrictEqual([]);
	});
});

describe("renderStandardPolicies", () => {
	it("writes one spelling per rule: the owner first, then the system bypass", () => {
		const sql = renderStandardPolicies({ Note: [{ name: "note_own", rule: "ownerOrSystem", column: "userId" }] });
		expect(sql).toContain(`DROP POLICY IF EXISTS note_own ON public."Note";`);
		expect(sql).toContain(`USING (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
		expect(sql).toContain(`WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
	});

	it("gives a read rule no WITH CHECK, an insert rule no USING, and honours a role", () => {
		const read = renderStandardPolicies({ Note: [{ name: "note_read", rule: "systemRead", to: "app_runtime" }] });
		expect(read).toContain("FOR SELECT\n  TO app_runtime\n  USING (");
		expect(read).not.toContain("WITH CHECK");
		const insert = renderStandardPolicies({ Note: [{ name: "note_add", rule: "systemInsert" }] });
		expect(insert).toContain("FOR INSERT\n  WITH CHECK (");
		expect(insert).not.toContain("USING");
	});

	it("renders the api-key and readable rules", () => {
		expect(renderStandardPolicies({ Note: [{ name: "n", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" }] })).toContain(
			`USING (app_api_key_org_access("tenantId"))`,
		);
		expect(renderStandardPolicies({ Note: [{ name: "n", rule: "readableByAll" }] })).toContain("USING (true)");
	});
});
