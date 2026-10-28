import { describe, expect, it } from "vitest";

import {
	isTenantPermission,
	MERCHANT_CAPABILITY,
	MERCHANT_CAPABILITY_PERMISSION,
	merchantCapabilitiesOf,
	MerchantCapabilitySchema,
	PERMISSION,
	TENANT_PERMISSIONS,
	TENANT_ROLE_TEMPLATE_NAMES,
	TENANT_ROLE_TEMPLATES,
	IMPLICIT_SELF_GRANTS,
	parsePermissionSlug,
	permissionSatisfies,
} from "../permission";
import { AuthorizationAttributeValueSchema } from "../policy-dsl.schema";
import { PermissionActionSchema } from "../../contexts/authorization/schemas/permission-enums";
import { MembershipRoleSchema } from "../../contexts/tenancy/schemas/tenant";

describe("permission vocabulary", () => {
	it("derives platform capability slugs from resource × action", () => {
		expect(PERMISSION.KANBAN_BOARD.UPDATE).toBe("platform:kanban_board.update");
		expect(PERMISSION.ORDER.DELETE).toBe("platform:order.delete");
		expect(PERMISSION.ADMIN_DASHBOARD.READ).toBe("platform:admin_dashboard.read");
	});

	it("round-trips slugs and fails closed on unknown ones", () => {
		expect(parsePermissionSlug(PERMISSION.REWARD.UPDATE)).toEqual({ action: "UPDATE", resource: "REWARD" });
		expect(parsePermissionSlug("platform:user.delte")).toBeNull();
		expect(parsePermissionSlug("merchant:rewards.read")).toBeNull();
		expect(parsePermissionSlug("USER:DELETE")).toBeNull();
	});

	it("is satisfied only by the same action on the same resource (no catch-all action)", () => {
		expect(permissionSatisfies({ action: "DELETE", resource: "ORDER" }, { action: "DELETE", resource: "ORDER" })).toBe(true);
		expect(permissionSatisfies({ action: "DELETE", resource: "ORDER" }, { action: "DELETE", resource: "PAYMENT" })).toBe(false);
		expect(permissionSatisfies({ action: "UPDATE", resource: "ORDER" }, { action: "READ", resource: "ORDER" })).toBe(false);
		expect(PermissionActionSchema.safeParse("MANAGE").success).toBe(false);
	});

	it("keeps implicit self grants to read/update of one's own account", () => {
		expect(IMPLICIT_SELF_GRANTS.map((pair) => `${pair.action}:${pair.resource}`).sort()).toEqual(["READ:PROFILE", "READ:USER", "UPDATE:PROFILE", "UPDATE:USER"]);
	});
});

describe("authorization attribute values", () => {
	it("accepts JSON scalars and scalar lists, and nothing executable or nested", () => {
		for (const value of ["ACTIVE", 150, true, null, ["a", 1]]) {
			expect(AuthorizationAttributeValueSchema.safeParse(value).success).toBe(true);
		}
		expect(AuthorizationAttributeValueSchema.safeParse({ field: "x", operator: "eval" }).success).toBe(false);
		expect(AuthorizationAttributeValueSchema.safeParse([["nested"]]).success).toBe(false);
	});
});

describe("tenant role templates", () => {
	const has = (role: "OWNER" | "MANAGER" | "CASHIER", action: string, resource: string): boolean =>
		TENANT_ROLE_TEMPLATES[role].some((held) => held.action === action && held.resource === resource);

	it("gives the Owner every tenant permission", () => {
		expect(TENANT_ROLE_TEMPLATES.OWNER).toEqual(TENANT_PERMISSIONS);
	});

	it("gives the Manager everything except the Owner-only permissions", () => {
		expect(has("MANAGER", "UPDATE", "REWARD")).toBe(true);
		expect(has("MANAGER", "UPDATE", "MEMBER")).toBe(true);
		expect(has("MANAGER", "DELETE", "SHARE")).toBe(true);
		for (const [resource, action] of [
			["KYB", "UPDATE"],
			["SUPPORT_ACCESS", "APPROVE"],
			["TENANT", "UPDATE"],
		] satisfies [string, string][]) {
			expect(has("MANAGER", action, resource)).toBe(false);
		}
	});

	it("keeps the Cashier at the counter: no analytics, no team, no management", () => {
		expect(has("CASHIER", "REDEEM", "CLAIM")).toBe(true);
		expect(has("CASHIER", "READ", "REWARD")).toBe(true);
		expect(has("CASHIER", "READ", "ANALYTICS")).toBe(false);
		expect(has("CASHIER", "UPDATE", "REWARD")).toBe(false);
		expect(has("CASHIER", "UPDATE", "MEMBER")).toBe(false);
	});

	it("draws every template permission from the tenant catalogue, and names each template", () => {
		for (const role of MembershipRoleSchema.options) {
			expect(TENANT_ROLE_TEMPLATES[role].every(isTenantPermission)).toBe(true);
			expect(TENANT_ROLE_TEMPLATE_NAMES[role].length).toBeGreaterThan(0);
		}
		expect(isTenantPermission({ action: "DELETE", resource: "USER" })).toBe(false);
	});
});

describe("merchant capability bridge", () => {
	it("maps every capability slug to a tenant permission", () => {
		for (const capability of MerchantCapabilitySchema.options) {
			expect(isTenantPermission(MERCHANT_CAPABILITY_PERMISSION[capability])).toBe(true);
		}
	});

	it("derives the capabilities a set of permissions satisfies", () => {
		expect(merchantCapabilitiesOf(TENANT_ROLE_TEMPLATES.OWNER)).toEqual(MerchantCapabilitySchema.options);
		expect(merchantCapabilitiesOf([{ action: "READ", resource: "ANALYTICS" }])).toEqual([MERCHANT_CAPABILITY.viewAnalytics]);
		expect(merchantCapabilitiesOf([])).toEqual([]);
	});

	it("registers every capability slug exactly once", () => {
		const byName = (left: string, right: string): number => left.localeCompare(right);
		expect(Object.values(MERCHANT_CAPABILITY).sort(byName)).toEqual([...MerchantCapabilitySchema.options].sort(byName));
	});
});
