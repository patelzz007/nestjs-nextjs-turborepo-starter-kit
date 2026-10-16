import { describe, expect, it } from "vitest";

import { BRAND_MARK_FACETS, BRAND_MARK_SIZE, BRAND_MARK_VIEW_BOX, type BrandMarkFacet } from "./brand";

const COORDINATE_PATTERN = /-?\d+(?:\.\d+)?/gu;

function coordinatesOf(facet: BrandMarkFacet): readonly number[] {
	return [...facet.path.matchAll(COORDINATE_PATTERN)].map(([match]) => Number(match));
}

describe("brand mark", () => {
	it("is drawn in a 24 × 24 box", () => {
		expect(BRAND_MARK_SIZE).toBe(24);
		expect(BRAND_MARK_VIEW_BOX).toBe("0 0 24 24");
	});

	it("has the cube's three faces, lit top to shadowed right", () => {
		expect(BRAND_MARK_FACETS.map((facet) => facet.name)).toStrictEqual(["top", "left", "right"]);
		const [top, left, right] = BRAND_MARK_FACETS.map((facet) => facet.opacity);
		expect(top).toBe(1);
		expect(left).toBeLessThan(top ?? 0);
		expect(right).toBeLessThan(left ?? 0);
		expect(right).toBeGreaterThan(0);
	});

	it("keeps every face a closed four-point shape inside the box", () => {
		for (const facet of BRAND_MARK_FACETS) {
			const coordinates = coordinatesOf(facet);
			expect(facet.path.endsWith("Z")).toBe(true);
			expect(coordinates).toHaveLength(8);
			expect(coordinates.every((value) => value >= 0 && value <= BRAND_MARK_SIZE)).toBe(true);
		}
	});
});
