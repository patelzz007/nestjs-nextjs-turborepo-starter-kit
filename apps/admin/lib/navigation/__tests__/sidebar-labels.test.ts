import { sidebarLabelKeys } from "@workspace/client/lib/sidebar/sidebar-menu-labels";
import { describe, expect, it } from "vitest";

import { ADMIN_SIDEBAR_LABELS } from "../sidebar-labels";
import { SIDEBAR_MENU_DATA } from "../sidebar-menu";

const USED = [...sidebarLabelKeys(SIDEBAR_MENU_DATA)].sort();

describe("the admin sidebar's label pack (enhancement 5.12)", () => {
	it("gives every language exactly the keys the menu uses, each with words", () => {
		for (const words of Object.values(ADMIN_SIDEBAR_LABELS)) {
			expect(Object.keys(words).sort()).toStrictEqual(USED);
			expect(Object.values(words).filter((word) => word.trim().length === 0)).toStrictEqual([]);
		}
	});

	it("uses each key once", () => {
		expect(new Set(USED).size).toBe(USED.length);
	});
});
