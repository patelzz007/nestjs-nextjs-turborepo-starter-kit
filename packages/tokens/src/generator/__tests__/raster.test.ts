import { describe, expect, it } from "vitest";

import { BRAND_MARK_FACETS } from "../brand";
import { rasterizeTile, UnsupportedIconInputError, type TileSpec } from "./raster";

const SPEC: TileSpec = { size: 24, radius: 6.6, markScale: 0.5, markOffset: 6, tileColor: "#4f6583", markColor: "#ffffff" };
const PIXELS = 48;

function pixelAt(bytes: Uint8Array, x: number, y: number): readonly number[] {
	const start = (y * PIXELS + x) * 4;
	return [...bytes.subarray(start, start + 4)];
}

describe("rasterizeTile", () => {
	const bytes = rasterizeTile(SPEC, BRAND_MARK_FACETS, PIXELS);

	it("draws every pixel as RGBA", () => {
		expect(bytes).toHaveLength(PIXELS * PIXELS * 4);
	});

	it("leaves the rounded corners transparent and fills the edges with the tile colour", () => {
		expect(pixelAt(bytes, 0, 0)).toStrictEqual([0, 0, 0, 0]);
		expect(pixelAt(bytes, PIXELS / 2, 1)).toStrictEqual([0x4f, 0x65, 0x83, 255]);
	});

	it("paints the top facet in the mark colour at full strength", () => {
		expect(pixelAt(bytes, PIXELS / 2, Math.round(PIXELS * 0.38))).toStrictEqual([255, 255, 255, 255]);
	});

	it("fills the corners when the tile has no radius", () => {
		expect(pixelAt(rasterizeTile({ ...SPEC, radius: 0 }, BRAND_MARK_FACETS, PIXELS), 0, 0)).toStrictEqual([0x4f, 0x65, 0x83, 255]);
	});

	it("draws the mark alone on transparency when there is no tile", () => {
		const markOnly = rasterizeTile({ ...SPEC, tileColor: null }, BRAND_MARK_FACETS, PIXELS);

		expect(pixelAt(markOnly, PIXELS / 2, 1)).toStrictEqual([0, 0, 0, 0]);
		expect(pixelAt(markOnly, PIXELS / 2, Math.round(PIXELS * 0.38))).toStrictEqual([255, 255, 255, 255]);
	});

	it("refuses a colour that is not #rrggbb", () => {
		expect(() => rasterizeTile({ ...SPEC, tileColor: "oklch(0.5 0.05 257)" }, BRAND_MARK_FACETS, PIXELS)).toThrow(UnsupportedIconInputError);
	});
});
