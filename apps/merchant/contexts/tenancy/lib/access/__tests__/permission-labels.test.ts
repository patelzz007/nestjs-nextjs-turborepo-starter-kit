import { TENANT_PERMISSIONS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	actionLabel,
	groupPermissions,
	permissionKey,
	permissionLabel,
	resourceLabel,
	samePermission,
	TENANT_PERMISSION_GROUPS,
} from "@/contexts/tenancy/lib/access/permission-labels";

describe("permission labels", () => {
	it("names a permission by its subject and verb", () => {
		expect(permissionLabel({ action: "UPDATE", resource: "REWARD" })).toBe("Rewards · Edit");
		expect(actionLabel("READ")).toBe("View");
		expect(resourceLabel("KYB")).toBe("Business verification");
		expect(resourceLabel("ADMIN_DASHBOARD")).toBe("admin dashboard");
		expect(permissionKey({ action: "READ", resource: "REWARD" })).toBe("REWARD.READ");
	});

	it("groups permissions by subject in catalogue order, losing none", () => {
		const groups = groupPermissions([
			{ action: "READ", resource: "REWARD" },
			{ action: "READ", resource: "ANALYTICS" },
			{ action: "UPDATE", resource: "REWARD" },
		]);

		expect(groups.map((group) => [group.label, group.permissions.length])).toEqual([
			["Rewards", 2],
			["Analytics", 1],
		]);
		expect(TENANT_PERMISSION_GROUPS.flatMap((group) => group.permissions)).toHaveLength(TENANT_PERMISSIONS.length);
	});

	it("compares permissions by subject and verb", () => {
		expect(samePermission({ action: "READ", resource: "REWARD" }, { action: "READ", resource: "REWARD" })).toBe(true);
		expect(samePermission({ action: "READ", resource: "REWARD" }, { action: "UPDATE", resource: "REWARD" })).toBe(false);
	});
});
