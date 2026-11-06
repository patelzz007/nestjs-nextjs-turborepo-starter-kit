import { TABLE_POLICIES, type StandardRule, type TablePolicy } from "./table-policies";

/** The generated file, relative to the api workspace. */
export const STANDARD_POLICIES_PATH = "prisma/rls/97-standard-policies.sql";

const HEADER = `-- ============================================================================
-- GENERATED from prisma/rls/table-policies.ts by prisma/rls/standard-policies.ts
-- — do not edit by hand. Regenerate: pnpm --filter @workspace/api db:generate-rls-policies
-- ============================================================================
-- The policies that repeat across tables, one spelling per rule (ADR 083). One-off
-- policies stay hand-written in the other numbered fragments. This file runs after
-- them, so every helper it calls is defined.
`;

/** What a rule's clauses say, given the table's bypass check and the column's name. */
interface RuleClauses {
	readonly command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
	readonly using?: string;
	readonly withCheck?: string;
}

function bothWays(predicate: string): RuleClauses {
	return { using: predicate, withCheck: predicate };
}

function clausesOf(rule: StandardRule, bypass: string, column: string): RuleClauses {
	const clauses: Readonly<Record<StandardRule, RuleClauses>> = {
		system: bothWays(bypass),
		systemRead: { command: "SELECT", using: bypass },
		systemInsert: { command: "INSERT", withCheck: bypass },
		systemUpdate: { command: "UPDATE", ...bothWays(bypass) },
		systemDelete: { command: "DELETE", using: bypass },
		ownerOrSystem: bothWays(`app_owns("${column}") OR ${bypass}`),
		tenantMemberOrSystem: bothWays(`app_tenant_org_member("${column}") OR ${bypass}`),
		tenantMemberReadOrSystem: { command: "SELECT", using: `app_tenant_org_member("${column}") OR ${bypass}` },
		readableByAll: { command: "SELECT", using: "true" },
		apiKeyRead: { command: "SELECT", using: `app_api_key_org_access("${column}")` },
		apiKeyInsert: { command: "INSERT", withCheck: `app_api_key_org_access("${column}")` },
		apiKeyUpdate: { command: "UPDATE", ...bothWays(`app_api_key_org_access("${column}")`) },
	};
	return clauses[rule];
}

function renderPolicy(table: string, policy: TablePolicy): string {
	const { command, using, withCheck } = clausesOf(policy.rule, `(SELECT app_rls_bypass_on('${table}'))`, policy.column ?? "");
	const lines = [
		`DROP POLICY IF EXISTS ${policy.name} ON public."${table}";`,
		`CREATE POLICY ${policy.name} ON public."${table}"`,
		...(command === undefined ? [] : [`  FOR ${command}`]),
		...(policy.to === undefined ? [] : [`  TO ${policy.to}`]),
		...(using === undefined ? [] : [`  USING (${using})`]),
		...(withCheck === undefined ? [] : [`  WITH CHECK (${withCheck})`]),
	];
	return `${lines.join("\n")};\n`;
}

/** The whole generated file. */
export function renderStandardPolicies(tables: Readonly<Record<string, readonly TablePolicy[]>> = TABLE_POLICIES): string {
	const blocks = Object.entries(tables).flatMap(([table, policies]) => policies.map((policy) => renderPolicy(table, policy)));
	return `${HEADER}\n${blocks.join("\n")}`;
}
