import type { CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { describe, expect, it } from "vitest";

import { applyEnrollmentNavLock } from "@/lib/navigation/apply-enrollment-nav-lock";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

function enabledUrls(items: readonly CompiledSidebarMenuItem[]): readonly string[] {
	return items.flatMap((item) => [...(item.disabled === true ? [] : [item.url]), ...enabledUrls(item.children ?? [])]);
}

describe("applyEnrollmentNavLock", () => {
	it("leaves the menu untouched when the session is not restricted", () => {
		expect(applyEnrollmentNavLock(MERCHANT_SIDEBAR_MENU, false)).toBe(MERCHANT_SIDEBAR_MENU);
	});

	it("keeps only the personal account reachable during enrollment", () => {
		const locked = applyEnrollmentNavLock(MERCHANT_SIDEBAR_MENU, true);
		const urls = [...locked.sections.flatMap((section) => enabledUrls(section.items)), ...enabledUrls(locked.bottomItems)];

		expect(urls).toEqual(["/account"]);
	});
});
