import { PermissionActionSchema } from "@workspace/shared";
import { Shield } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
	permissionActionBadgeVariant,
	permissionActionFallbackIcon,
	permissionActionIcon,
	permissionActionIconClassName,
	permissionActionSummary,
} from "@/contexts/authorization/lib/permission-action-style";

describe("permission action style", () => {
	it("gives every action — CRUD and the lifecycle verbs — an icon, a badge, a colour and a summary", () => {
		for (const action of PermissionActionSchema.options) {
			expect(permissionActionIcon(action), action).toBeTruthy();
			expect(permissionActionBadgeVariant(action), action).toBeTruthy();
			expect(permissionActionIconClassName(action).length, action).toBeGreaterThan(0);
			expect(permissionActionSummary(action), action).toMatch(/^Grants /);
		}
	});

	it("falls back to the shield icon", () => {
		expect(permissionActionFallbackIcon()).toBe(Shield);
	});
});
