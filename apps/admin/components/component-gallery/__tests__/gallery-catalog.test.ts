import { describe, expect, it } from "vitest";

import {
	EXAMPLE_ONLY_KEYS,
	GALLERY_CATALOG_ORDER,
	GALLERY_ENTRIES,
	GALLERY_FAMILIES,
	galleryItemBySlug,
	galleryNeighbours,
	GalleryComponentKeySchema,
	GalleryFamilyIdSchema,
	NOT_SHOWN_COMPONENTS,
} from "@/components/component-gallery/gallery-catalog";

const ALL_KEYS = GalleryComponentKeySchema.options;

describe("component gallery catalog", () => {
	it("lists every component in exactly one family", () => {
		const listed = GALLERY_FAMILIES.flatMap((family) => family.keys);
		expect([...listed].sort()).toEqual([...ALL_KEYS].sort());
		expect(new Set(listed).size).toBe(listed.length);
	});

	it("demonstrates the 103 low-level primitives the gallery promises — 70 with live demos, 33 through their worked examples", () => {
		expect(ALL_KEYS).toHaveLength(103);
		expect(EXAMPLE_ONLY_KEYS.size).toBe(33);
		for (const key of EXAMPLE_ONLY_KEYS) {
			expect(ALL_KEYS).toContain(key);
		}
	});

	it("gives every family a unique anchor, in the declared order, with at least one component", () => {
		expect(GALLERY_FAMILIES.map((family) => family.id)).toEqual(GalleryFamilyIdSchema.options);
		for (const family of GALLERY_FAMILIES) {
			expect(family.keys.length, family.title).toBeGreaterThan(0);
		}
	});

	it("gives every component a unique, prefixed anchor id and a unique exported name", () => {
		const entries = ALL_KEYS.map((key) => GALLERY_ENTRIES[key]);
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
		const componentIds = new Set(ALL_KEYS.map((key) => GALLERY_ENTRIES[key].id));
		for (const family of GALLERY_FAMILIES) {
			expect(componentIds.has(family.id)).toBe(false);
		}
	});

	it("names the out-of-scope kit components", () => {
		expect(NOT_SHOWN_COMPONENTS.length).toBeGreaterThan(0);
		expect(NOT_SHOWN_COMPONENTS.join(" ")).toContain("theme-provider");
		expect(NOT_SHOWN_COMPONENTS.join(" ")).toContain("image-cropper");
	});

	it("orders every component family by family, each with its own family", () => {
		expect(GALLERY_CATALOG_ORDER.map((item) => item.key)).toEqual(GALLERY_FAMILIES.flatMap((family) => family.keys));
		for (const item of GALLERY_CATALOG_ORDER) {
			expect(item.family.keys).toContain(item.key);
			expect(item.entry).toBe(GALLERY_ENTRIES[item.key]);
		}
	});

	it("finds a component by its page slug, and nothing for an unknown slug", () => {
		expect(galleryItemBySlug("button-group")?.key).toBe("buttonGroup");
		expect(galleryItemBySlug("data-grid")?.family.id).toBe("family-data-display");
		expect(galleryItemBySlug("not-a-component")).toBeUndefined();
		expect(galleryItemBySlug("")).toBeUndefined();
	});

	it("links each component to its neighbours in catalog order, with no wrap-around", () => {
		const [first] = GALLERY_CATALOG_ORDER;
		const last = GALLERY_CATALOG_ORDER.at(-1);
		expect(galleryNeighbours("button")).toEqual({ previous: undefined, next: GALLERY_CATALOG_ORDER.at(1) });
		expect(galleryNeighbours("buttonGroup").previous).toBe(first);
		if (last !== undefined) {
			expect(galleryNeighbours(last.key).next).toBeUndefined();
		}
	});
});
