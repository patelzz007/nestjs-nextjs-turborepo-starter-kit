import { describe, expect, it } from "vitest";

import type { AccordionDemoItem } from "@/components/showcase/accordion-showcase";
import { ACCORDION_FAQ_ITEMS, ACCORDION_REORDER_ITEMS, ACCORDION_STATUS_ITEMS, ACCORDION_VARIANT_ITEMS } from "@/components/showcase/accordion-demo-items";

function flatten(items: readonly AccordionDemoItem[]): readonly AccordionDemoItem[] {
	return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

const GROUPS: readonly (readonly [name: string, items: readonly AccordionDemoItem[]])[] = [
	["faq", ACCORDION_FAQ_ITEMS],
	["status", ACCORDION_STATUS_ITEMS],
	["reorder", ACCORDION_REORDER_ITEMS],
	["variant", ACCORDION_VARIANT_ITEMS],
];

describe("accordion demo items", () => {
	it.each(GROUPS)("%s items have unique ids and values, and a title and body each", (_name, items) => {
		const all = flatten(items);
		expect(all.length).toBeGreaterThan(0);
		expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
		expect(new Set(all.map((item) => item.value)).size).toBe(all.length);
		for (const item of all) {
			expect(item.title.length, item.id).toBeGreaterThan(0);
			expect(item.body.length, item.id).toBeGreaterThan(0);
		}
	});

	it("covers every row state the status demo shows: done, loading, error, disabled and lazy", () => {
		expect(ACCORDION_STATUS_ITEMS.map((item) => item.status).filter((status) => status !== undefined)).toEqual(["done", "loading", "error"]);
		expect(ACCORDION_STATUS_ITEMS.some((item) => item.disabled === true)).toBe(true);
		expect(ACCORDION_STATUS_ITEMS.some((item) => item.lazy === true)).toBe(true);
	});

	it("nests sub-questions under one FAQ item", () => {
		expect(ACCORDION_FAQ_ITEMS.filter((item) => (item.children ?? []).length > 0)).toHaveLength(1);
	});
});
