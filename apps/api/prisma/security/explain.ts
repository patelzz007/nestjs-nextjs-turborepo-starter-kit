import { clausesOf } from "./generator";
import { TABLE_SPECIFIC_RULES } from "./generator/table-specific-rules";
import { DATABASE_ROLES, type DatabaseRoleName } from "./roles";
import { RULE_DESCRIPTIONS } from "./rule-catalogue";
import type { PolicyDeclaration, PolicyRule, TableSpecificRule } from "./table-policies";
import type { WithheldPrivilege } from "./withheld-privileges";

/**
 * `pnpm db:security-explain <Table>`: who may read and write a table, in plain words, straight from the
 * declarations (table-policies.ts, roles.ts, withheld-privileges.ts) — so nobody needs to read the generated SQL.
 */

/** What the explanation reads about one table. */
export interface ExplainInputs {
	readonly table: string;
	readonly policies: readonly PolicyDeclaration[];
	readonly withheld: readonly WithheldPrivilege[];
}

const COMMAND_WORDS: Readonly<Record<string, string>> = {
	ALL: "read + write",
	SELECT: "read",
	INSERT: "insert",
	UPDATE: "update",
	DELETE: "delete",
};

function isPolicyRule(rule: PolicyRule | TableSpecificRule): rule is PolicyRule {
	return rule in RULE_DESCRIPTIONS;
}

/** One policy, as a sentence: who, and on which inputs. */
function describePolicy(policy: PolicyDeclaration): string {
	const { rule } = policy;
	const base = isPolicyRule(rule) ? RULE_DESCRIPTIONS[rule] : TABLE_SPECIFIC_RULES[rule].description;
	const details = [
		policy.resource !== undefined && policy.action !== undefined ? `permission ${policy.resource.toLowerCase()}.${policy.action.toLowerCase()}` : undefined,
		policy.column === undefined ? undefined : `column "${policy.column}"`,
		policy.storeColumn === undefined ? undefined : `store "${policy.storeColumn}"`,
		policy.operations === undefined ? undefined : `operations ${policy.operations.join(", ")}`,
		policy.where === undefined ? undefined : `rows where "${policy.where.column}" = ${String(policy.where.equals)}`,
	].filter((detail: string | undefined): detail is string => detail !== undefined);
	return details.length === 0 ? base : `${base} — ${details.join("; ")}`;
}

/** The database roles that hold a named grant on the table (beyond app_runtime's blanket one). */
function namedGrants(table: string): string[] {
	return Object.entries(DATABASE_ROLES).flatMap(([role, definition]): string[] =>
		(definition.tableGrants ?? [])
			.filter((grant): boolean => grant.tables.some((granted: string): boolean => granted === table))
			.map((grant): string => `${role}: ${grant.privileges.join(", ")}${grant.columns === undefined ? "" : ` (${grant.columns.join(", ")})`}`),
	);
}

function roleLabel(role: DatabaseRoleName | undefined): string {
	return role ?? "every role";
}

/** The explanation, line by line. */
export function explainTable(inputs: ExplainInputs): string[] {
	const { table, policies, withheld } = inputs;
	const lines = [`${table}: row-level security is enabled and forced.`];
	if (policies.length === 0) {
		lines.push("  No policy: nobody but the table owner may read or write it.");
	}
	for (const policy of policies) {
		const command = clausesOf(table, policy).command ?? "ALL";
		lines.push(`  ${policy.name} [${COMMAND_WORDS[command] ?? command}, ${roleLabel(policy.to)}]`);
		lines.push(`    ${describePolicy(policy)}`);
	}
	lines.push("A row is reachable when ANY policy above admits it.");
	if (withheld.length > 0) {
		lines.push(`app_runtime may never: ${withheld.join(", ")} (withheld-privileges.ts).`);
	}
	const grants = namedGrants(table);
	if (grants.length > 0) {
		lines.push("Other roles' grants:", ...grants.map((grant: string): string => `  ${grant}`));
	}
	return lines;
}
