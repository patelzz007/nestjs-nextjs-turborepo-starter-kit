import { describe, expect, it } from "vitest";

import { assignableRoleOptions } from "@/contexts/authorization/components/role-picker";

describe("assignableRoleOptions", () => {
	it("offers platform roles the user does not hold, never a tenant-role template", () => {
		const roles = [
			{ id: "admin", name: "Admin", kind: "PLATFORM" },
			{ id: "user", name: "User", kind: "PLATFORM" },
			{ id: "cashier-template", name: "Cashier", kind: "TEMPLATE" },
		] satisfies Parameters<typeof assignableRoleOptions>[0];

		expect(assignableRoleOptions(roles, new Set(["user"]))).toEqual([{ id: "admin", label: "Admin" }]);
	});
});
