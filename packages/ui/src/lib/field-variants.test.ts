import { describe, expect, it } from "vitest";

import { collectionItemActiveSurfaceClasses, resolveCollectionItemActiveClasses, resolveCollectionItemDensityClasses, resolveMenuItemActiveClasses } from "./field-variants";

describe("resolveCollectionItemDensityClasses", () => {
	it("returns taller default density", () => {
		expect(resolveCollectionItemDensityClasses("default")).toContain("min-h-9");
		expect(resolveCollectionItemDensityClasses("default")).toContain("py-2");
	});
});

describe("resolveCollectionItemActiveClasses", () => {
	it("returns active surface classes when selected", () => {
		const classes = resolveCollectionItemActiveClasses({ selected: true, highlighted: false });
		expect(classes).toBe(collectionItemActiveSurfaceClasses);
	});

	it("returns active surface classes when highlighted", () => {
		const classes = resolveCollectionItemActiveClasses({ selected: false, highlighted: true });
		expect(classes).toBe(collectionItemActiveSurfaceClasses);
	});

	it("returns empty string when idle", () => {
		expect(resolveCollectionItemActiveClasses({ selected: false, highlighted: false })).toBe("");
	});
});

describe("resolveMenuItemActiveClasses", () => {
	it("returns active surface classes when checked", () => {
		const classes = resolveMenuItemActiveClasses({ highlighted: false, checked: true });
		expect(classes.length).toBeGreaterThan(0);
	});
});
