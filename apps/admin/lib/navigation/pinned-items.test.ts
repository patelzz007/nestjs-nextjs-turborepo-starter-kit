import { describe, expect, it } from "vitest";

import { resolvePinnedMenuItems } from "@/lib/navigation/pinned-items";
import { SEARCHABLE_ITEMS } from "@/lib/palette/search";

describe("resolvePinnedMenuItems", () => {
	it("resolves pinned URLs against the same searchable index as the command palette", () => {
		const sample = SEARCHABLE_ITEMS[0];
		expect(sample).toBeDefined();
		if (sample === undefined) {
			return;
		}

		const resolved = resolvePinnedMenuItems([sample.url, "/not-in-menu"]);
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

		const resolved = resolvePinnedMenuItems([sample.url, sample.url]);
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

		const resolved = resolvePinnedMenuItems([second.url, first.url]);
		expect(resolved.map((item) => item.url)).toEqual([second.url, first.url]);
	});
});
