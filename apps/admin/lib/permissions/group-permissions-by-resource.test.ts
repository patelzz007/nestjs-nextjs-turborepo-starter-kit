import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { groupPermissionsByResource } from "@/lib/permissions/group-permissions-by-resource";

describe("groupPermissionsByResource", () => {
	it("groups permissions by resource and sorts actions", () => {
		const groups = groupPermissionsByResource([
			{ id: "1", action: "UPDATE", resource: "USER", description: null, group: null },
			{ id: "2", action: "READ", resource: "USER", description: null, group: null },
			{ id: "3", action: "READ", resource: "ADMIN_DASHBOARD", description: null, group: null },
		]);

		expect(groups.map((group) => group.resource)).toEqual(["ADMIN_DASHBOARD", "USER"]);
		expect(groups[LIST_SLOT_INDEX.second]?.permissions.map((perm) => perm.action)).toEqual(["READ", "UPDATE"]);
	});
});
