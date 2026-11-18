import { MERCHANT_CAPABILITY_PERMISSION, MerchantCapabilitySchema, type PermissionPair } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CAPABILITY_TABLE_ACCESS, type TableCommand } from "../capability-access";
import { clausesOf } from "../generator";
import { TABLE_POLICIES, type PolicyDeclaration } from "../table-policies";

/** Reusable rules that admit every member of the row's tenant to read, whatever their role. */
const MEMBER_WIDE_READ_RULES: ReadonlySet<string> = new Set(["tenantMemberReadOrSystem", "systemOrActiveTenantMemberRead"]);
/** Helpers whose presence in a one-off rule admits every member (store branding, the store list). */
const MEMBER_WIDE_HELPERS: readonly string[] = ["app_tenant_org_member(", "app_tenant_member_of(", "app_member_of("];

const POLICIES = new Map<string, readonly PolicyDeclaration[]>(Object.entries(TABLE_POLICIES));

function policiesOf(table: string): readonly PolicyDeclaration[] {
	return POLICIES.get(table) ?? [];
}

/** The command a policy applies to (`ALL` covers every command). */
function commandOf(table: string, policy: PolicyDeclaration): TableCommand | "ALL" {
	return clausesOf(table, policy).command ?? "ALL";
}

function appliesTo(table: string, policy: PolicyDeclaration, command: TableCommand): boolean {
	const applies = commandOf(table, policy);
	return (applies === "ALL" || applies === command) && (policy.to === undefined || policy.to === "app_runtime");
}

/** Whether a member holding `permission` passes `policy` for `command`. */
function admits(table: string, policy: PolicyDeclaration, command: TableCommand, permission: PermissionPair): boolean {
	if (!appliesTo(table, policy, command)) {
		return false;
	}
	if (policy.resource !== undefined) {
		return policy.resource === permission.resource && policy.action === permission.action;
	}
	if (command === "SELECT" && MEMBER_WIDE_READ_RULES.has(policy.rule)) {
		return true;
	}
	const clauses = clausesOf(table, policy);
	const text = [clauses.using ?? "", clauses.withCheck ?? ""].join("\n");
	// A rule that checks permissions must name this one; only a rule with no permission check at all admits by membership.
	if (text.includes("app_permitted_")) {
		return (
			text.includes(`app_permitted_tenants('${permission.resource}', '${permission.action}')`) ||
			text.includes(`app_permitted_stores('${permission.resource}', '${permission.action}')`)
		);
	}
	return MEMBER_WIDE_HELPERS.some((helper) => text.includes(helper));
}

describe("merchant capabilities against the table policies (ADR 090)", () => {
	it("declares the tables of every capability", () => {
		expect(Object.keys(CAPABILITY_TABLE_ACCESS).sort()).toStrictEqual([...MerchantCapabilitySchema.options].sort());
	});

	it("lets every capability do, at the database, what its routes do as the member", () => {
		const refused: string[] = [];
		for (const [capability, accesses] of Object.entries(CAPABILITY_TABLE_ACCESS)) {
			const permission = MERCHANT_CAPABILITY_PERMISSION[MerchantCapabilitySchema.parse(capability)];
			for (const access of accesses) {
				for (const command of access.commands) {
					if (!policiesOf(access.table).some((policy) => admits(access.table, policy, command, permission))) {
						refused.push(`${capability} → ${command} ${access.table} (${permission.resource}.${permission.action})`);
					}
				}
			}
		}
		expect(refused).toStrictEqual([]);
	});

	it("keeps no permission policy that no capability's routes use", () => {
		const unused: string[] = [];
		for (const [table, policies] of POLICIES) {
			for (const policy of policies.filter((candidate) => candidate.resource !== undefined)) {
				const command = commandOf(table, policy);
				const used = Object.entries(CAPABILITY_TABLE_ACCESS).some(([capability, accesses]) => {
					const permission = MERCHANT_CAPABILITY_PERMISSION[MerchantCapabilitySchema.parse(capability)];
					return (
						permission.resource === policy.resource &&
						permission.action === policy.action &&
						accesses.some((access) => access.table === table && (command === "ALL" || access.commands.includes(command)))
					);
				});
				if (!used) {
					unused.push(`${table}.${policy.name} (${policy.resource ?? ""}.${policy.action ?? ""} ${command})`);
				}
			}
		}
		expect(unused).toStrictEqual([]);
	});

	it("catches a route whose verb the database does not admit", () => {
		const terminalRead: PermissionPair = { resource: "TERMINAL", action: "READ" };
		expect(policiesOf("TenantTerminal").some((policy) => admits("TenantTerminal", policy, "INSERT", terminalRead))).toBe(false);
		expect(policiesOf("TenantTerminal").some((policy) => admits("TenantTerminal", policy, "SELECT", terminalRead))).toBe(true);
		const rewardRead: PermissionPair = { resource: "REWARD", action: "READ" };
		expect(policiesOf("StoredFile").some((policy) => admits("StoredFile", policy, "INSERT", rewardRead))).toBe(false);
		expect(policiesOf("Location").some((policy) => admits("Location", policy, "SELECT", rewardRead))).toBe(true);
	});
});
