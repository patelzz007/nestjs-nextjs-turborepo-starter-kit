import { describe, expect, it } from "vitest";

import {
	NOT_SHOWN_COMPONENTS,
	SHOWCASE_CATALOG_ORDER,
	SHOWCASE_ENTRIES,
	SHOWCASE_FAMILIES,
	ShowcaseComponentKeySchema,
	ShowcaseFamilyIdSchema,
} from "@/components/component-showcase/showcase-catalog";
import { SHOWCASE_FAMILY_META } from "@/components/component-showcase/showcase-family-meta";

const ALL_KEYS = ShowcaseComponentKeySchema.options;
/** The low-level kit components the showcase promises. */
const SHOWN_COMPONENT_COUNT = 106;

describe("component showcase catalog", () => {
	it("lists every component in exactly one family", () => {
		const listed = SHOWCASE_FAMILIES.flatMap((family) => family.keys);
		expect([...listed].sort()).toEqual([...ALL_KEYS].sort());
		expect(new Set(listed).size).toBe(listed.length);
	});

	it("shows the 106 low-level components the page promises", () => {
		expect(ALL_KEYS).toHaveLength(SHOWN_COMPONENT_COUNT);
	});

	it("gives every family a unique anchor, in the declared order, with at least one component and its presentation", () => {
		expect(SHOWCASE_FAMILIES.map((family) => family.id)).toEqual(ShowcaseFamilyIdSchema.options);
		for (const family of SHOWCASE_FAMILIES) {
			expect(family.keys.length, family.title).toBeGreaterThan(0);
			expect(SHOWCASE_FAMILY_META[family.id].summary.length, family.title).toBeGreaterThan(0);
		}
	});

	it("gives every component a unique, prefixed anchor id and a unique exported name", () => {
		const entries = ALL_KEYS.map((key) => SHOWCASE_ENTRIES[key]);
		const ids = entries.map((entry) => entry.id);
		const names = entries.map((entry) => entry.name);
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(names).size).toBe(names.length);
		for (const entry of entries) {
			expect(entry.id).toMatch(/^component-[a-z]+(-[a-z]+)*$/);
			expect(entry.id).toBe(`component-${entry.slug}`);
			// A component (PascalCase) or a hook (`useFileUpload`), exactly as the kit exports it.
			expect(entry.name).toMatch(/^(?:[A-Z][A-Za-z]+|use[A-Z][A-Za-z]+)$/);
			expect(entry.description.length, entry.name).toBeGreaterThan(0);
		}
	});

	it("never collides a component anchor with a family anchor", () => {
		const componentIds = new Set(ALL_KEYS.map((key) => SHOWCASE_ENTRIES[key].id));
		for (const family of SHOWCASE_FAMILIES) {
			expect(componentIds.has(family.id)).toBe(false);
		}
	});

	it("names the out-of-scope kit components", () => {
		expect(NOT_SHOWN_COMPONENTS.join(" ")).toContain("theme-provider");
		expect(NOT_SHOWN_COMPONENTS.join(" ")).toContain("image-cropper");
	});

	it("orders every component family by family, each with its own family", () => {
		expect(SHOWCASE_CATALOG_ORDER.map((item) => item.key)).toEqual(SHOWCASE_FAMILIES.flatMap((family) => family.keys));
		for (const item of SHOWCASE_CATALOG_ORDER) {
			expect(item.family.keys).toContain(item.key);
			expect(item.entry).toBe(SHOWCASE_ENTRIES[item.key]);
		}
	});
});
