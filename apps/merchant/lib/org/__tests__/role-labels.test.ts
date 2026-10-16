import { OrganizationMembershipRoleSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ORGANIZATION_ROLE_LABELS } from "@/lib/org/role-labels";

describe("ORGANIZATION_ROLE_LABELS", () => {
	it("names every organization role", () => {
		for (const role of OrganizationMembershipRoleSchema.options) {
			expect(ORGANIZATION_ROLE_LABELS[role].length, role).toBeGreaterThan(0);
		}
		expect(ORGANIZATION_ROLE_LABELS.POLICY_ADMIN).toBe("Policy admin");
	});
});
