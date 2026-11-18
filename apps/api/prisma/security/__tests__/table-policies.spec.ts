import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import { assertDeleteMatchesWrite, clausesOf, renderPolicies, renderPolicy } from "../generator";
import { PolicyDeclarationError, type PolicyClauses } from "../generator/policy-clauses";
import { POLICY_RULES } from "../generator/policy-rules";
import { TABLE_SPECIFIC_RULES, type TableSpecificRules } from "../generator/table-specific-rules";
import { RULE, RULE_DESCRIPTIONS, type RuleCatalogue } from "../rule-catalogue";
import { parsePrismaSchemaModels } from "../manifest-index";
import {
	MEMBERSHIP_WRITE_EXCEPTIONS,
	MEMBERSHIP_WRITE_RULES,
	TABLE_POLICIES,
	type ColumnPolicy,
	type PermissionPolicy,
	type PolicyDeclaration,
	type PolicyRule,
	type TableOfSpecificRule,
	type TablePolicies,
	type TablePolicy,
	type TableSpecificRuleOf,
} from "../table-policies";
import type { ColumnOf, PermissionResource, SystemOperationName, TableName } from "../table-types";

const apiDir = resolve(import.meta.dirname, "..", "..", "..");
const NOTE: ReadonlySet<string> = new Set(["Note"]);

function prismaTables(): string[] {
	return parsePrismaSchemaModels(readFileSync(resolve(apiDir, "prisma", "schema.prisma"), "utf8")).map((model) => model.tableName);
}

describe("the table policy list", () => {
	it("names every table, so a new table cannot go without a decision", () => {
		const models = prismaTables();
		expect(models.filter((model) => !(model in TABLE_POLICIES))).toStrictEqual([]);
		expect(Object.keys(TABLE_POLICIES).filter((table) => !models.includes(table))).toStrictEqual([]);
	});

	it("gives every policy of a table its own name", () => {
		for (const [table, policies] of Object.entries(TABLE_POLICIES)) {
			const names = policies.map((policy) => policy.name);
			expect(new Set(names).size, table).toBe(names.length);
		}
	});

	it("renders every declared policy (each rule has the inputs it needs, each one-off rule is on its own table)", () => {
		for (const [table, policies] of Object.entries(TABLE_POLICIES)) {
			for (const policy of policies) {
				expect((): string => renderPolicy(table, policy), `${table}.${policy.name}`).not.toThrow();
			}
		}
	});

	it("declares no policy for every command whose writes are checked differently from its reads (DELETE would use the reads)", () => {
		const offenders = Object.entries(TABLE_POLICIES).flatMap(([table, policies]) =>
			policies.flatMap((policy) => {
				const clauses = clausesOf(table, policy);
				return clauses.command === undefined && clauses.withCheck !== undefined && clauses.withCheck !== clauses.using ? [`${table}.${policy.name}`] : [];
			}),
		);
		expect(offenders).toStrictEqual([]);
	});

	it("keeps shares, referrals and referral codes read-only to people: every write, a delete included, is a system operation", () => {
		const readOnly: readonly { readonly table: TableName; readonly policy: string; readonly system: string }[] = [
			{ table: "ResourceAcl", policy: "resource_acls_member", system: "resource_acls_system" },
			{ table: "RewardReferral", policy: "reward_referrals_parties", system: "reward_referrals_system" },
			{ table: "SignupReferral", policy: "signup_referrals_referrer", system: "signup_referrals_system" },
			{ table: "SignupReferralCode", policy: "signup_referral_codes_own", system: "signup_referral_codes_system" },
		];
		for (const { table, policy, system } of readOnly) {
			const declared = TABLE_POLICIES[table];
			const read = declared.find((candidate) => candidate.name === policy);
			const write = declared.find((candidate) => candidate.name === system);
			expect(read === undefined ? undefined : clausesOf(table, read).command, `${table}.${policy}`).toBe("SELECT");
			expect(write?.rule, `${table}.${system}`).toBe("system");
			// Nothing else on the table lets a person write: every other policy reads, or is the API key's or the system's.
			const peopleWriting = declared.filter((candidate) => candidate.name !== system && candidate.to === undefined && clausesOf(table, candidate).command !== "SELECT");
			expect(
				peopleWriting.map((candidate) => candidate.name),
				table,
			).toStrictEqual([]);
		}
	});

	it("maps no model or field to another name, because the policy types assume model = table and field = column", () => {
		const schema = readFileSync(resolve(apiDir, "prisma", "schema.prisma"), "utf8");
		expect(schema.split("\n").filter((line) => /@@?map\(/.test(line.replace(/\/\/.*$/, "")))).toStrictEqual([]);
	});

	it("lets no tenant table be written by every member regardless of role, unless listed with a reason", () => {
		const models = parsePrismaSchemaModels(readFileSync(resolve(apiDir, "prisma", "schema.prisma"), "utf8"));
		const tenantTables = new Set(models.filter((model) => model.hasTenantId).map((model) => model.tableName));
		const loose = Object.entries(TABLE_POLICIES)
			.filter(([table]) => tenantTables.has(table) && !(table in MEMBERSHIP_WRITE_EXCEPTIONS))
			.flatMap(([table, policies]) => policies.filter((policy) => MEMBERSHIP_WRITE_RULES.has(policy.rule)).map((policy) => `${table}.${policy.name}`));
		expect(loose).toStrictEqual([]);
		expect(tenantTables.size).toBeGreaterThan(0);
	});

	it("uses every one-off rule exactly where it belongs", () => {
		const used = new Set<string>(Object.values(TABLE_POLICIES).flatMap((policies) => policies.map((policy) => policy.rule)));
		expect(Object.keys(TABLE_SPECIFIC_RULES).filter((rule) => !used.has(rule))).toStrictEqual([]);
	});
});

describe("the declaration types (what the editor autocompletes and the compiler checks)", () => {
	it("keys the list by every Prisma model", () => {
		expectTypeOf<keyof TablePolicies>().toEqualTypeOf<TableName>();
	});

	it("offers only a table's own columns", () => {
		expectTypeOf<"tenantId">().toExtend<ColumnOf<"Reward">>();
		expectTypeOf<"notAColumn">().not.toExtend<ColumnOf<"Reward">>();
		expectTypeOf<ColumnPolicy<"Reward">["column"]>().toEqualTypeOf<ColumnOf<"Reward">>();
	});

	it("offers only catalogue permissions and registry operations", () => {
		expectTypeOf<PermissionPolicy<"Reward">["resource"]>().toEqualTypeOf<PermissionResource>();
		expectTypeOf<"REWARD">().toExtend<PermissionResource>();
		expectTypeOf<"reward">().not.toExtend<PermissionResource>();
		expectTypeOf<"geo.reference_data.write">().toExtend<SystemOperationName>();
	});

	it("offers a one-off rule only on its own table", () => {
		expectTypeOf<TableSpecificRuleOf<"Reward">>().toEqualTypeOf<"rewardReadable" | "rewardEditable">();
		expectTypeOf<TableOfSpecificRule<"ownMembershipRead">>().toEqualTypeOf<"Membership">();
		expectTypeOf<{ name: "n"; rule: "rewardReadable" }>().not.toExtend<TablePolicy<"Location">>();
		expectTypeOf<{ name: "n"; rule: "rewardReadable" }>().toExtend<TablePolicy<"Reward">>();
	});

	it("demands each rule's inputs", () => {
		expectTypeOf<{ name: "n"; rule: "ownerOrSystem" }>().not.toExtend<TablePolicy<"BackupCode">>();
		expectTypeOf<{ name: "n"; rule: "ownerOrSystem"; column: "userId" }>().toExtend<TablePolicy<"BackupCode">>();
		expectTypeOf<{ name: "n"; rule: "ownerOrSystem"; column: "tenantId" }>().not.toExtend<TablePolicy<"BackupCode">>();
		expectTypeOf<{ name: "n"; rule: "roleRead" }>().not.toExtend<TablePolicy<"BackupCode">>();
	});

	it("documents every reusable rule in the RULE catalogue, and nothing else", () => {
		expectTypeOf<keyof RuleCatalogue>().toEqualTypeOf<PolicyRule>();
		expectTypeOf<RuleCatalogue[keyof RuleCatalogue]>().toEqualTypeOf<PolicyRule>();
		for (const [key, value] of Object.entries(RULE)) {
			expect(value).toBe(key);
		}
		expect(Object.keys(RULE_DESCRIPTIONS).sort()).toStrictEqual(Object.keys(POLICY_RULES).sort());
	});

	it("pairs each one-off rule's definition with the table its type names", () => {
		expectTypeOf<TableSpecificRules["rewardReadable"]["table"]>().toEqualTypeOf<"Reward">();
		expectTypeOf<TableSpecificRules["ownMembershipScopes"]["table"]>().toEqualTypeOf<"MembershipLocationScope">();
	});

	it("hands every typed policy to the generator", () => {
		expectTypeOf<TablePolicy<"Reward">>().toExtend<PolicyDeclaration>();
	});
});

describe("renderPolicy", () => {
	it("writes one spelling per rule: the owner first, then the system bypass", () => {
		const sql = renderPolicy("Note", { name: "note_own", rule: "ownerOrSystem", column: "userId" });
		expect(sql).toContain(`DROP POLICY IF EXISTS note_own ON public."Note";`);
		expect(sql).toContain(`USING (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
		expect(sql).toContain(`WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
	});

	it("gives a read rule no WITH CHECK, an insert rule no USING, and honours a role", () => {
		const read = renderPolicy("Note", { name: "note_read", rule: "systemRead", to: "app_runtime" });
		expect(read).toContain("FOR SELECT\n  TO app_runtime\n  USING (");
		expect(read).not.toContain("WITH CHECK");
		const insert = renderPolicy("Note", { name: "note_add", rule: "systemInsert" });
		expect(insert).toContain("FOR INSERT\n  WITH CHECK (");
		expect(insert).not.toContain("USING");
	});

	it("renders the api-key and readable rules", () => {
		expect(renderPolicy("Note", { name: "n", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" })).toContain(`USING (app_api_key_org_access("tenantId"))`);
		expect(renderPolicy("Note", { name: "n", rule: "readableByAll" })).toContain("USING (true)");
		expect(renderPolicy("Note", { name: "n", rule: "apiKeyStoreRead", column: "tenantId", storeColumn: "locationId" })).toContain(
			`USING (app_api_key_store_access("tenantId", "locationId"))`,
		);
	});

	it("renders a permission rule as a once-per-statement check of the permitted tenants, and stores when the table has one", () => {
		expect(renderPolicy("Note", { name: "n", rule: "permissionRead", resource: "REWARD", action: "READ", column: "tenantId" })).toContain(
			`FOR SELECT\n  USING ("tenantId" = ANY ((SELECT app_permitted_tenants('REWARD', 'READ'))::text[]) OR (SELECT app_rls_bypass_on('Note')))`,
		);
		const store = renderPolicy("Note", { name: "n", rule: "permissionUpdate", resource: "TERMINAL", action: "UPDATE", column: "tenantId", storeColumn: "locationId" });
		expect(store).toContain(`CASE WHEN "locationId" IS NULL THEN "tenantId" = ANY ((SELECT app_permitted_tenants('TERMINAL', 'UPDATE'))::text[])`);
		expect(store).toContain(`("tenantId" || '|*') = ANY ((SELECT app_permitted_stores('TERMINAL', 'UPDATE'))::text[])`);
		expect(store).toContain(`("tenantId" || '|' || "locationId") = ANY ((SELECT app_permitted_stores('TERMINAL', 'UPDATE'))::text[])`);
		// Never the per-row form: the row's columns are never passed to a function.
		expect(store).not.toContain("app_has_permission");
	});

	it("renders a dedicated role's policy for that role alone, with its row filter", () => {
		const sql = renderPolicy("Note", { name: "n", rule: "roleAll", to: "analytics_consumer", where: { column: "consumer", equals: "analytics-warehouse" } });
		expect(sql).toContain("TO analytics_consumer");
		expect(sql).toContain(`USING ("consumer" = 'analytics-warehouse')`);
		expect(renderPolicy("Note", { name: "n", rule: "roleRead", to: "app_retention" })).toContain("USING (true)");
		expect(renderPolicy("Note", { name: "n", rule: "roleRead", to: "analytics_consumer", where: { column: "isDeleted", equals: false } })).toContain(
			`USING ("isDeleted" = false)`,
		);
	});

	it("lets an owner update only their own row (or a system operation)", () => {
		const sql = renderPolicy("Note", { name: "n", rule: "ownerOrSystemUpdate", column: "userId" });
		expect(sql).toContain("FOR UPDATE");
		expect(sql).toContain(`USING (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
		expect(sql).toContain(`WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('Note')))`);
	});

	it("confines a member's own membership to the bound tenant (DB-008)", () => {
		const sql = renderPolicy("Membership", { name: "n", rule: "ownMembershipRead" });
		expect(sql).toContain(`app_owns("userId") AND (app_current_tenant_id() IS NULL OR app_current_tenant_id() = "tenantId")`);
	});

	it("limits a system-operation write to the named operations", () => {
		expect(renderPolicy("Note", { name: "n", rule: "systemOperationWrite", operations: ["geo.reference_data.write"] })).toContain(
			"(SELECT app_rls_bypass_on('Note')) AND app_system_operation() IN ('geo.reference_data.write')",
		);
	});

	it("quotes a policy name PostgreSQL would otherwise fold to lower case", () => {
		expect(renderPolicy("Note", { name: "Note_member", rule: "systemOrActiveTenantMemberRead", column: "tenantId" })).toContain(
			`CREATE POLICY "Note_member" ON public."Note"`,
		);
	});

	it("refuses a policy for every command that would let DELETE pass on a wider condition than its writes", () => {
		const policy: PolicyDeclaration = { name: "note_read_system_write", rule: "system" };
		const readWideWriteNarrow = { using: `app_owns("userId") OR (SELECT app_rls_bypass_on('Note'))`, withCheck: `(SELECT app_rls_bypass_on('Note'))` };
		expect((): PolicyClauses => assertDeleteMatchesWrite("Note", policy, readWideWriteNarrow)).toThrow(PolicyDeclarationError);
		// The same split correctly: a SELECT policy, and writes checked exactly as they are read.
		expect(assertDeleteMatchesWrite("Note", policy, { command: "SELECT", using: readWideWriteNarrow.using })).toStrictEqual({
			command: "SELECT",
			using: readWideWriteNarrow.using,
		});
		expect(assertDeleteMatchesWrite("Note", policy, { using: "x", withCheck: "x" })).toStrictEqual({ using: "x", withCheck: "x" });
		expect(assertDeleteMatchesWrite("Note", policy, { using: "x" })).toStrictEqual({ using: "x" });
	});

	it("rejects a rule without the input it needs", () => {
		const cases: readonly PolicyDeclaration[] = [
			{ name: "n", rule: "ownerOrSystem" },
			{ name: "n", rule: "apiKeyStoreRead", column: "tenantId" },
			{ name: "n", rule: "permission", column: "tenantId" },
			{ name: "n", rule: "systemOperationWrite" },
			{ name: "n", rule: "roleRead" },
		];
		for (const policy of cases) {
			expect((): string => renderPolicy("Note", policy), policy.rule).toThrow(PolicyDeclarationError);
		}
	});

	it("rejects an unsafe column, permission word, operation or row-filter value", () => {
		const cases: readonly PolicyDeclaration[] = [
			{ name: "n", rule: "ownerOrSystem", column: 'userId") OR true --' },
			{ name: "n", rule: "permission", column: "tenantId", resource: "reward'", action: "READ" },
			{ name: "n", rule: "systemOperationWrite", operations: ["x') OR true --"] },
			{ name: "n", rule: "roleAll", to: "app_retention", where: { column: "consumer", equals: "a' OR 'x" } },
			{ name: "n; DROP TABLE x", rule: "system" },
		];
		for (const policy of cases) {
			expect((): string => renderPolicy("Note", policy)).toThrow(PolicyDeclarationError);
		}
	});

	it("refuses a one-off rule on another table", () => {
		expect((): string => renderPolicy("Note", { name: "n", rule: "rewardReadable" })).toThrow(/belongs to Reward/);
		expect(clausesOf("Reward", { name: "n", rule: "rewardReadable" }).command).toBe("SELECT");
	});

	it("defines every reusable rule", () => {
		for (const [rule, definition] of Object.entries(POLICY_RULES)) {
			expect(definition.requires, rule).toBeDefined();
		}
	});
});

describe("renderPolicies", () => {
	it("enables and forces RLS on every listed table, even one with no policy", () => {
		const sql = renderPolicies({ Note: [] }, NOTE);
		expect(sql).toContain(`ALTER TABLE public."Note" ENABLE ROW LEVEL SECURITY;\nALTER TABLE public."Note" FORCE ROW LEVEL SECURITY;`);
	});

	it("drops policies the list no longer declares, on listed tables only", () => {
		const sql = renderPolicies({ Note: [{ name: "note_own", rule: "ownerOrSystem", column: "userId" }] }, NOTE);
		expect(sql).toContain("AND p.tablename = ANY (ARRAY['Note'])");
		expect(sql).toContain("('Note', 'note_own')");
		expect(sql).toContain("RAISE NOTICE 'Dropping undeclared policy % on %'");
	});

	it("fails instead of dropping an undeclared policy unless the session allows drops", () => {
		const sql = renderPolicies({ Note: [] }, NOTE);
		expect(sql).toContain("coalesce(current_setting('app.allow_policy_drops', true), '') <> 'on' THEN");
		expect(sql).toContain("RAISE EXCEPTION 'Undeclared policies would be dropped: %.");
		expect(sql.indexOf("RAISE EXCEPTION")).toBeLessThan(sql.indexOf("EXECUTE format('DROP POLICY"));
	});

	it("rejects a table the Prisma schema does not have, and a repeated policy name", () => {
		expect((): string => renderPolicies({ Gone: [] }, NOTE)).toThrow(/does not have: Gone/);
		const repeated: readonly PolicyDeclaration[] = [
			{ name: "n", rule: "system" },
			{ name: "n", rule: "systemRead" },
		];
		expect((): string => renderPolicies({ Note: repeated }, NOTE)).toThrow(/more than once/);
	});
});
