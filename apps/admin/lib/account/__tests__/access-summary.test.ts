import type { PermissionDetailsResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { summarizeAccess } from "@/lib/account/access-summary";

function permission(id: string, group: string | null): PermissionDetailsResponse {
	return { id, action: "LIST", resource: "USER", description: null, group };
}

describe("summarizeAccess", () => {
	it("counts every permission and lists each area once, alphabetically", () => {
		expect(summarizeAccess([permission("1", "Users"), permission("2", "Audit"), permission("3", "Users"), permission("4", null), permission("5", "")])).toStrictEqual({
			permissionCount: 5,
			areas: ["Audit", "Users"],
		});
	});

	it("is empty without permissions", () => {
		expect(summarizeAccess([])).toStrictEqual({ permissionCount: 0, areas: [] });
	});
});
