import { describe, expect, it } from "vitest";

import { buildPermissionTree } from "@/lib/build-permission-tree";
import { isRedundantResourceLabel } from "@/lib/permission-label-utils";

describe("buildPermissionTree", () => {
	it("groups permissions by group, then resource, then sorted action", () => {
		const tree = buildPermissionTree([
			{ id: "1", action: "UPDATE", resource: "USER", description: null, group: "User Management" },
			{ id: "2", action: "READ", resource: "USER", description: null, group: "User Management" },
			{ id: "3", action: "READ", resource: "ADMIN_DASHBOARD", description: null, group: "Admin Dashboard" },
			{ id: "4", action: "LIST", resource: "ROLE", description: null, group: null },
		]);

		expect(tree.map((node) => node.group)).toEqual(["Admin Dashboard", "Uncategorized", "User Management"]);
		expect(tree[2]?.resources.map((node) => node.resource)).toEqual(["USER"]);
		expect(tree[2]?.resources[0]?.permissions.map((leaf) => leaf.action)).toEqual(["READ", "UPDATE"]);
	});
});

describe("isRedundantResourceLabel", () => {
	it("detects matching group and resource labels", () => {
		expect(isRedundantResourceLabel("Analytics", "ANALYTICS")).toBe(true);
		expect(isRedundantResourceLabel("Profile Management", "PROFILE")).toBe(true);
		expect(isRedundantResourceLabel("API Key Management", "API_KEY")).toBe(true);
	});
});
