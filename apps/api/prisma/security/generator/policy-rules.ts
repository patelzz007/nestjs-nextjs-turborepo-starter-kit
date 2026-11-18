import type { PolicyRule, PolicyDeclaration } from "../table-policies";
import { permitted } from "./permission-check";
import { bothWays, PolicyDeclarationError, systemBypass, type PolicyClauses } from "./policy-clauses";

/**
 * What every reusable rule of table-policies.ts checks: one spelling per rule. A rule reads the table's own
 * columns (`column`, `storeColumn`), the catalogue permission (`resource`, `action`), the named operations,
 * or a dedicated role's row filter (`where`) from its declaration; `requires` lists which it needs, and the
 * generator refuses a declaration that leaves one out.
 */

/** A declaration field a rule needs. */
export type RuleInput = "column" | "storeColumn" | "permission" | "operations" | "to";

/** One reusable rule: the inputs it needs and the clauses it renders for a table. */
export interface RuleDefinition {
	readonly requires: readonly RuleInput[];
	readonly render: (table: string, policy: PolicyDeclaration) => PolicyClauses;
}

/** A PostgreSQL identifier this generator interpolates (a table, column or role name). */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** A catalogue resource or action (`REWARD`, `READ`). */
const SAFE_CATALOGUE_WORD = /^[A-Z][A-Z_]*$/;
/** A system operation name (`geo.reference_data.write`). */
const SAFE_OPERATION = /^[a-z_]+(?:\.[a-z_]+)+$/;
/** A row-filter text value. */
const SAFE_TEXT_VALUE = /^[A-Za-z0-9_.-]+$/;

/** `value` checked against `pattern`; the declaration is rejected otherwise, so nothing unvalidated reaches SQL. */
export function checked(value: string, pattern: RegExp, what: string): string {
	if (!pattern.test(value)) {
		throw new PolicyDeclarationError(`Unsafe ${what}: ${value}`);
	}
	return value;
}

/** A quoted column of the table. */
function columnOf(policy: PolicyDeclaration): string {
	return `"${checked(policy.column ?? "", SAFE_IDENTIFIER, `column of ${policy.name}`)}"`;
}

/** The quoted store column of the table. */
function storeColumnOf(policy: PolicyDeclaration): string {
	return `"${checked(policy.storeColumn ?? "", SAFE_IDENTIFIER, `store column of ${policy.name}`)}"`;
}

/** The ROLE and GRANT allow paths for `resource.action` at the row's tenant (and store), asked once per statement. */
function permissionCheck(policy: PolicyDeclaration): string {
	const resource = checked(policy.resource ?? "", SAFE_CATALOGUE_WORD, `resource of ${policy.name}`);
	const action = checked(policy.action ?? "", SAFE_CATALOGUE_WORD, `action of ${policy.name}`);
	return permitted(resource, action, columnOf(policy), policy.storeColumn === undefined ? undefined : storeColumnOf(policy));
}

/** A dedicated role's row filter, or `true` (every row). */
function rowFilter(policy: PolicyDeclaration): string {
	if (policy.where === undefined) {
		return "true";
	}
	const column = checked(policy.where.column, SAFE_IDENTIFIER, `row filter column of ${policy.name}`);
	const { equals } = policy.where;
	const value = equals === true || equals === false ? String(equals) : `'${checked(equals, SAFE_TEXT_VALUE, `row filter value of ${policy.name}`)}'`;
	return `"${column}" = ${value}`;
}

/** `bypass AND app_system_operation() IN (…)`: the scoped bypass, and only these named operations. */
function namedOperations(table: string, policy: PolicyDeclaration): string {
	const operations = (policy.operations ?? []).map((operation: string): string => `'${checked(operation, SAFE_OPERATION, `operation of ${policy.name}`)}'`);
	if (operations.length === 0) {
		throw new PolicyDeclarationError(`${policy.name} names no operation`);
	}
	return `${systemBypass(table)} AND app_system_operation() IN (${operations.join(", ")})`;
}

const NONE: readonly RuleInput[] = [];
const COLUMN: readonly RuleInput[] = ["column"];
const STORE: readonly RuleInput[] = ["column", "storeColumn"];
const PERMISSION: readonly RuleInput[] = ["column", "permission"];
const ROLE: readonly RuleInput[] = ["to"];

export const POLICY_RULES: Readonly<Record<PolicyRule, RuleDefinition>> = {
	// ── System operations only ──
	system: { requires: NONE, render: (table) => bothWays(systemBypass(table)) },
	systemRead: { requires: NONE, render: (table) => ({ command: "SELECT", using: systemBypass(table) }) },
	systemInsert: { requires: NONE, render: (table) => ({ command: "INSERT", withCheck: systemBypass(table) }) },
	systemUpdate: { requires: NONE, render: (table) => ({ command: "UPDATE", ...bothWays(systemBypass(table)) }) },
	systemDelete: { requires: NONE, render: (table) => ({ command: "DELETE", using: systemBypass(table) }) },
	systemOperationWrite: { requires: ["operations"], render: (table, policy) => bothWays(namedOperations(table, policy)) },

	// ── Ownership ──
	ownerOrSystem: { requires: COLUMN, render: (table, policy) => bothWays(`app_owns(${columnOf(policy)}) OR ${systemBypass(table)}`) },
	systemOrOwner: { requires: COLUMN, render: (table, policy) => bothWays(`${systemBypass(table)} OR (app_owns(${columnOf(policy)}))`) },
	ownerOrSystemRead: { requires: COLUMN, render: (table, policy) => ({ command: "SELECT", using: `app_owns(${columnOf(policy)}) OR ${systemBypass(table)}` }) },
	ownerOrSystemInsert: { requires: COLUMN, render: (table, policy) => ({ command: "INSERT", withCheck: `app_owns(${columnOf(policy)}) OR ${systemBypass(table)}` }) },
	ownerOrSystemUpdate: {
		requires: COLUMN,
		render: (table, policy) => ({ command: "UPDATE", ...bothWays(`app_owns(${columnOf(policy)}) OR ${systemBypass(table)}`) }),
	},
	ownerRead: { requires: COLUMN, render: (_table, policy) => ({ command: "SELECT", using: `app_owns(${columnOf(policy)})` }) },

	// ── Tenant membership ──
	tenantMemberOrSystem: { requires: COLUMN, render: (table, policy) => bothWays(`app_tenant_org_member(${columnOf(policy)}) OR ${systemBypass(table)}`) },
	tenantMemberReadOrSystem: {
		requires: COLUMN,
		render: (table, policy) => ({ command: "SELECT", using: `app_tenant_org_member(${columnOf(policy)}) OR ${systemBypass(table)}` }),
	},
	systemOrTenantMember: { requires: COLUMN, render: (table, policy) => bothWays(`${systemBypass(table)} OR app_tenant_org_member(${columnOf(policy)})`) },
	systemOrActiveTenantMember: { requires: COLUMN, render: (table, policy) => bothWays(`${systemBypass(table)} OR app_tenant_member_of(${columnOf(policy)})`) },
	systemOrActiveTenantMemberRead: {
		requires: COLUMN,
		render: (table, policy) => ({ command: "SELECT", using: `${systemBypass(table)} OR app_tenant_member_of(${columnOf(policy)})` }),
	},
	systemOrStoreAccess: {
		requires: STORE,
		render: (table, policy) => bothWays(`${systemBypass(table)} OR (app_tenant_row_org_location_access(${columnOf(policy)}, ${storeColumnOf(policy)}))`),
	},
	systemOrOptionalStoreAccess: {
		requires: STORE,
		render: (table, policy) => bothWays(`${systemBypass(table)} OR (app_tenant_org_optional_location_access(${columnOf(policy)}, ${storeColumnOf(policy)}))`),
	},

	// ── Tenant permissions (ADR 067) ──
	permission: { requires: PERMISSION, render: (table, policy) => bothWays(`${permissionCheck(policy)} OR ${systemBypass(table)}`) },
	permissionRead: { requires: PERMISSION, render: (table, policy) => ({ command: "SELECT", using: `${permissionCheck(policy)} OR ${systemBypass(table)}` }) },
	permissionInsert: { requires: PERMISSION, render: (table, policy) => ({ command: "INSERT", withCheck: `${permissionCheck(policy)} OR ${systemBypass(table)}` }) },
	permissionUpdate: { requires: PERMISSION, render: (table, policy) => ({ command: "UPDATE", ...bothWays(`${permissionCheck(policy)} OR ${systemBypass(table)}`) }) },
	permissionDelete: { requires: PERMISSION, render: (table, policy) => ({ command: "DELETE", using: `${permissionCheck(policy)} OR ${systemBypass(table)}` }) },

	// ── Merchant API keys ──
	apiKeyRead: { requires: COLUMN, render: (_table, policy) => ({ command: "SELECT", using: `app_api_key_org_access(${columnOf(policy)})` }) },
	apiKeyInsert: { requires: COLUMN, render: (_table, policy) => ({ command: "INSERT", withCheck: `app_api_key_org_access(${columnOf(policy)})` }) },
	apiKeyUpdate: { requires: COLUMN, render: (_table, policy) => ({ command: "UPDATE", ...bothWays(`app_api_key_org_access(${columnOf(policy)})`) }) },
	apiKeyNullableTenantRead: {
		requires: COLUMN,
		render: (_table, policy) => ({ command: "SELECT", using: `${columnOf(policy)} IS NOT NULL AND app_api_key_org_access(${columnOf(policy)})` }),
	},
	apiKeyNullableTenantInsert: {
		requires: COLUMN,
		render: (_table, policy) => ({ command: "INSERT", withCheck: `${columnOf(policy)} IS NOT NULL AND app_api_key_org_access(${columnOf(policy)})` }),
	},
	apiKeyStoreRead: { requires: STORE, render: (_table, policy) => ({ command: "SELECT", using: `app_api_key_store_access(${columnOf(policy)}, ${storeColumnOf(policy)})` }) },
	apiKeyStoreInsert: {
		requires: STORE,
		render: (_table, policy) => ({ command: "INSERT", withCheck: `app_api_key_store_access(${columnOf(policy)}, ${storeColumnOf(policy)})` }),
	},
	apiKeyStoreUpdate: {
		requires: STORE,
		render: (_table, policy) => ({ command: "UPDATE", ...bothWays(`app_api_key_store_access(${columnOf(policy)}, ${storeColumnOf(policy)})`) }),
	},
	apiKeyRewardRead: { requires: COLUMN, render: (_table, policy) => ({ command: "SELECT", using: `app_api_key_reward_access(${columnOf(policy)})` }) },
	apiKeyRewardInsert: { requires: COLUMN, render: (_table, policy) => ({ command: "INSERT", withCheck: `app_api_key_reward_access(${columnOf(policy)})` }) },
	apiKeyRewardUpdate: { requires: COLUMN, render: (_table, policy) => ({ command: "UPDATE", ...bothWays(`app_api_key_reward_access(${columnOf(policy)})`) }) },
	apiKeySignupRefereeRead: { requires: COLUMN, render: (_table, policy) => ({ command: "SELECT", using: `app_api_key_signup_referee_access(${columnOf(policy)})` }) },
	apiKeySignupRefereeUpdate: {
		requires: COLUMN,
		render: (_table, policy) => ({ command: "UPDATE", ...bothWays(`app_api_key_signup_referee_access(${columnOf(policy)})`) }),
	},
	apiKeyCustomerRead: { requires: COLUMN, render: (_table, policy) => ({ command: "SELECT", using: `app_api_key_customer_access(${columnOf(policy)})` }) },

	// ── Public and append-only ──
	readableByAll: { requires: NONE, render: () => ({ command: "SELECT", using: "true" }) },
	anyoneInsert: { requires: NONE, render: () => ({ command: "INSERT", withCheck: "true" }) },
	triggerInsert: { requires: NONE, render: () => ({ command: "INSERT", withCheck: "pg_trigger_depth() > 0" }) },
	triggerUpdate: { requires: NONE, render: () => ({ command: "UPDATE", ...bothWays("pg_trigger_depth() > 0") }) },
	triggerOrSystemRead: { requires: NONE, render: (table) => ({ command: "SELECT", using: `pg_trigger_depth() > 0 OR ${systemBypass(table)}` }) },

	// ── A dedicated role ──
	roleRead: { requires: ROLE, render: (_table, policy) => ({ command: "SELECT", using: rowFilter(policy) }) },
	roleInsert: { requires: ROLE, render: (_table, policy) => ({ command: "INSERT", withCheck: rowFilter(policy) }) },
	roleUpdate: { requires: ROLE, render: (_table, policy) => ({ command: "UPDATE", ...bothWays(rowFilter(policy)) }) },
	roleDelete: { requires: ROLE, render: (_table, policy) => ({ command: "DELETE", using: rowFilter(policy) }) },
	roleAll: { requires: ROLE, render: (_table, policy) => bothWays(rowFilter(policy)) },
};

/** The inputs a declaration provides. */
function providedInputs(policy: PolicyDeclaration): ReadonlySet<RuleInput> {
	const present: readonly [RuleInput, boolean][] = [
		["column", policy.column !== undefined],
		["storeColumn", policy.storeColumn !== undefined],
		["permission", policy.resource !== undefined && policy.action !== undefined],
		["operations", policy.operations !== undefined],
		["to", policy.to !== undefined],
	];
	return new Set(present.filter(([, isPresent]): boolean => isPresent).map(([input]): RuleInput => input));
}

/** Rejects a declaration that leaves out an input its rule needs (`table.policy: rule needs column`). */
export function assertRuleInputs(table: string, policy: PolicyDeclaration, requires: readonly RuleInput[]): void {
	const provided = providedInputs(policy);
	const missing = requires.filter((input: RuleInput): boolean => !provided.has(input));
	if (missing.length > 0) {
		throw new PolicyDeclarationError(`${table}.${policy.name}: rule "${policy.rule}" needs ${missing.join(", ")}`);
	}
}

/** Checks a table name before it is interpolated. */
export function checkedTable(table: string): string {
	return checked(table, SAFE_IDENTIFIER, "table name");
}
