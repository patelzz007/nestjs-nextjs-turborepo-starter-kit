import { describe, expect, it } from "vitest";

import { PERMISSION } from "@workspace/shared";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { resolvePinnedMenuItems } from "@/lib/navigation/pinned-items";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";

const SEARCHABLE_ITEMS = buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, []));

describe("resolvePinnedMenuItems", () => {
	it("resolves pinned URLs against the same searchable index as the command palette", () => {
		const sample = SEARCHABLE_ITEMS[0];
		expect(sample).toBeDefined();
		if (sample === undefined) {
			return;
		}

		const resolved = resolvePinnedMenuItems([sample.url, "/not-in-menu"], SEARCHABLE_ITEMS);
		expect(resolved).toHaveLength(1);
		expect(resolved[0]?.url).toBe(sample.url);
		expect(resolved[0]?.title).toBe(sample.title);
	});

	it("dedupes duplicate pinned URLs", () => {
		const sample = SEARCHABLE_ITEMS[0];
		expect(sample).toBeDefined();
		if (sample === undefined) {
			return;
		}

		const resolved = resolvePinnedMenuItems([sample.url, sample.url], SEARCHABLE_ITEMS);
		expect(resolved).toHaveLength(1);
	});

	it("preserves pin order from the store", () => {
		const first = SEARCHABLE_ITEMS[0];
		const second = SEARCHABLE_ITEMS[1];
		expect(first).toBeDefined();
		expect(second).toBeDefined();
		if (first === undefined || second === undefined) {
			return;
		}

		const resolved = resolvePinnedMenuItems([second.url, first.url], SEARCHABLE_ITEMS);
		expect(resolved.map((item) => item.url)).toEqual([second.url, first.url]);
	});

	it("drops a pin to a page the session is no longer authorized for", () => {
		const authorized = buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, [PERMISSION.PRODUCT.LIST], { enabledFeatureFlags: [] }));
		expect(resolvePinnedMenuItems(["/catalog/products"], authorized)).toHaveLength(1);

		const revoked = buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, [], { enabledFeatureFlags: [] }));
		expect(resolvePinnedMenuItems(["/catalog/products"], revoked)).toHaveLength(0);
	});
});
