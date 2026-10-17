import { describe, expect, it } from "vitest";

import {
	collectionItemActiveSurfaceClasses,
	collectionItemDestructiveActiveSurfaceClasses,
	collectionItemHighlightSurfaceClasses,
	collectionItemSelectedHighlightedSurfaceClasses,
	resolveCollectionItemActiveClasses,
	resolveCollectionItemDensityClasses,
	menuItemSoftActiveSurfaceClasses,
	resolveMenuItemActiveClasses,
} from "../field-variants";

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

	it("gives an unselected row under the pointer a soft highlight, never the selected pill", () => {
		const classes = resolveCollectionItemActiveClasses({ selected: false, highlighted: true });
		expect(classes).toBe(collectionItemHighlightSurfaceClasses);
		expect(classes).not.toContain("bg-invert");
	});

	it("keeps the selected pill on the selected row while it is highlighted, a shade softer", () => {
		const classes = resolveCollectionItemActiveClasses({ selected: true, highlighted: true });
		expect(classes).toBe(collectionItemSelectedHighlightedSurfaceClasses);
		expect(classes).not.toBe(collectionItemActiveSurfaceClasses);
	});

	it("tints destructive rows red whether selected or highlighted", () => {
		expect(resolveCollectionItemActiveClasses({ selected: false, highlighted: true }, "destructive")).toBe(collectionItemDestructiveActiveSurfaceClasses);
		expect(resolveCollectionItemActiveClasses({ selected: true, highlighted: false }, "destructive")).toBe(collectionItemDestructiveActiveSurfaceClasses);
	});

	it("returns empty string when idle", () => {
		expect(resolveCollectionItemActiveClasses({ selected: false, highlighted: false })).toBe("");
	});
});

describe("resolveMenuItemActiveClasses", () => {
	it("returns active surface classes when highlighted", () => {
		const classes = resolveMenuItemActiveClasses({ highlighted: true, checked: false });
		expect(classes.length).toBeGreaterThan(0);
	});

	it("re-colours a row's secondary (muted) text on the inverted surface, as the collection rows do", () => {
		const classes = resolveMenuItemActiveClasses({ highlighted: true, checked: true });
		expect(classes).toContain("[&_.text-muted-foreground]:text-invert-foreground/80");
		expect(collectionItemActiveSurfaceClasses).toContain("[&_.text-muted-foreground]:text-invert-foreground/80");
	});

	it("washes a highlighted row softly, leaving its colours alone, when asked for the soft highlight", () => {
		const classes = resolveMenuItemActiveClasses({ highlighted: true }, "default", "soft");
		expect(classes).toBe(menuItemSoftActiveSurfaceClasses);
		expect(classes).not.toContain("invert");
		expect(resolveMenuItemActiveClasses({ highlighted: true }, "destructive", "soft")).toContain("bg-destructive/10");
	});

	it("returns empty string when only checked (indicator is enough)", () => {
		expect(resolveMenuItemActiveClasses({ highlighted: false, checked: true })).toBe("");
	});
});
