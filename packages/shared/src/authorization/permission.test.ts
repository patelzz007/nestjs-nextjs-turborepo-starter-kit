import { describe, expect, it } from "vitest";

import {
	MERCHANT_CAPABILITY,
	MERCHANT_ROLE_CAPABILITIES,
	merchantRoleHasCapability,
	PERMISSION,
	IMPLICIT_SELF_GRANTS,
	parsePermissionSlug,
	permissionSatisfies,
	readResourceCapability,
	withResourceCapability,
} from "./permission";
import { PolicyConditionsSchema } from "./policy-dsl.schema";

describe("permission vocabulary", () => {
	it("derives platform capability slugs from resource × action", () => {
		expect(PERMISSION.DEVTOOLS.MANAGE).toBe("platform:devtools.manage");
		expect(PERMISSION.ORDER.DELETE).toBe("platform:order.delete");
		expect(PERMISSION.ADMIN_DASHBOARD.READ).toBe("platform:admin_dashboard.read");
	});

	it("round-trips slugs and fails closed on unknown ones", () => {
		expect(parsePermissionSlug(PERMISSION.API_KEY.UPDATE)).toEqual({ action: "UPDATE", resource: "API_KEY" });
		expect(parsePermissionSlug("platform:user.delte")).toBeNull();
		expect(parsePermissionSlug("merchant:rewards.read")).toBeNull();
		expect(parsePermissionSlug("USER:DELETE")).toBeNull();
	});

	it("treats MANAGE as every action on the same resource only", () => {
		expect(permissionSatisfies({ action: "MANAGE", resource: "ORDER" }, { action: "DELETE", resource: "ORDER" })).toBe(true);
		expect(permissionSatisfies({ action: "MANAGE", resource: "ORDER" }, { action: "DELETE", resource: "PAYMENT" })).toBe(false);
		expect(permissionSatisfies({ action: "READ", resource: "ORDER" }, { action: "UPDATE", resource: "ORDER" })).toBe(false);
	});

	it("keeps implicit self grants to read/update of one's own account", () => {
		expect(IMPLICIT_SELF_GRANTS.map((pair) => `${pair.action}:${pair.resource}`).sort()).toEqual(["READ:PROFILE", "READ:USER", "UPDATE:PROFILE", "UPDATE:USER"]);
	});

	it("reads and writes server-provided resource capabilities", () => {
		const map = withResourceCapability(withResourceCapability({}, "DELETE", false), "UPDATE", true);

		expect(map).toEqual({ delete: false, update: true });
		expect(readResourceCapability(map, "UPDATE")).toBe(true);
		expect(readResourceCapability(map, "READ")).toBeUndefined();
	});
});

describe("policy DSL schema", () => {
	it("accepts nested all/any/condition rules", () => {
		const parsed = PolicyConditionsSchema.safeParse({
			all: [
				{ condition: { field: "order.organizationId", operator: "equals", valueRef: "$user.organizationId" } },
				{ any: [{ condition: { field: "order.status", operator: "not_equals", value: "COMPLETED" } }] },
			],
		});

		expect(parsed.success).toBe(true);
	});

	it("rejects executable-looking or legacy shapes", () => {
		expect(PolicyConditionsSchema.safeParse({ all: [{ operator: "gte", path: "context.hour", value: 9 }] }).success).toBe(false);
		expect(PolicyConditionsSchema.safeParse({ condition: { field: "x", operator: "eval", value: "process.exit()" } }).success).toBe(false);
		expect(PolicyConditionsSchema.safeParse("user.storeId === order.storeId").success).toBe(false);
	});
});

describe("merchant role capabilities", () => {
	it("gives owners and admins every capability", () => {
		expect(MERCHANT_ROLE_CAPABILITIES.OWNER).toContain(MERCHANT_CAPABILITY.manageApiKeys);
		expect(merchantRoleHasCapability("ADMIN", MERCHANT_CAPABILITY.manageRewards)).toBe(true);
	});

	it("keeps cashiers read-only", () => {
		expect(merchantRoleHasCapability("CASHIER", MERCHANT_CAPABILITY.viewRedemptions)).toBe(true);
		expect(merchantRoleHasCapability("CASHIER", MERCHANT_CAPABILITY.manageRewards)).toBe(false);
		expect(merchantRoleHasCapability("CASHIER", MERCHANT_CAPABILITY.manageApiKeys)).toBe(false);
	});

	it("limits policy admins and members to the dashboard", () => {
		for (const role of ["POLICY_ADMIN", "MEMBER"] satisfies ("POLICY_ADMIN" | "MEMBER")[]) {
			expect(MERCHANT_ROLE_CAPABILITIES[role]).toEqual([MERCHANT_CAPABILITY.viewDashboard]);
		}
	});

	it("fails closed on unknown capabilities", () => {
		expect(merchantRoleHasCapability("OWNER", "merchant:manage_kyb")).toBe(false);
	});
});
