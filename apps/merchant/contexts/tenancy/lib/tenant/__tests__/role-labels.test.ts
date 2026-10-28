import { MembershipRoleSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TENANT_ROLE_LABELS } from "@/contexts/tenancy/lib/tenant/role-labels";

describe("TENANT_ROLE_LABELS", () => {
	it("names every tenant role", () => {
		for (const role of MembershipRoleSchema.options) {
			expect(TENANT_ROLE_LABELS[role].length, role).toBeGreaterThan(0);
		}
		expect(TENANT_ROLE_LABELS).toEqual({ OWNER: "Owner", MANAGER: "Manager", CASHIER: "Cashier" });
	});
});
