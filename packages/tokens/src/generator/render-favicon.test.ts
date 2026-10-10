import { describe, expect, it } from "vitest";

import { BRAND_MARK_FACETS } from "../brand";
import { TOKEN_SOURCE } from "../source";
import { createColorLookups, resolveColorValue } from "../resolve";
import {
	APPLE_TOUCH_ICON_SIZE,
	DEFAULT_FAVICON_VARIANT as DEFAULT_VARIANT,
	FAVICON_VARIANTS,
	renderAppleTouchIcon,
	renderFaviconIco,
	renderFaviconSvg,
	type FaviconVariant,
} from "./render-favicon";
import { formatSrgbHex } from "./srgb-hex";

describe("renderFaviconSvg", () => {
	const svg = renderFaviconSvg(TOKEN_SOURCE, DEFAULT_VARIANT);

	it("is the mobile sign-in tile — the auth-brand-from square, its corners and its half-size mark — in hex colours", () => {
		expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"');
		expect(svg).toContain(`fill="${formatSrgbHex(resolveColorValue({ kind: "token", name: "auth-brand-from" }, createColorLookups(TOKEN_SOURCE, "light")))}"`);
		expect(svg).toContain('rx="6.6"');
		expect(svg).toContain('<g transform="translate(6 6) scale(0.5)">');
		expect(svg).not.toContain("oklch(");
	});

	it("draws every face of the brand mark in the panel foreground at its own strength", () => {
		for (const facet of BRAND_MARK_FACETS) {
			expect(svg).toContain(`<path d="${facet.path}" fill="#ffffff" fill-opacity="${String(facet.opacity)}"/>`);
		}
	});

	it("says it is generated", () => {
		expect(svg).toContain("<!-- GENERATED FILE");
		expect(svg.startsWith("<svg")).toBe(true);
	});
});

describe("renderFaviconIco", () => {
	it("holds the tile at 16 and 32 px, for Safari and older browsers", () => {
		const ico = Buffer.from(renderFaviconIco(TOKEN_SOURCE, DEFAULT_VARIANT));

		expect(ico.readUInt16LE(4)).toBe(2);
		expect([ico.readUInt8(6), ico.readUInt8(22)]).toStrictEqual([16, 32]);
	});
});

describe("renderAppleTouchIcon", () => {
	it("is a 180 px PNG", () => {
		const png = Buffer.from(renderAppleTouchIcon(TOKEN_SOURCE, DEFAULT_VARIANT));

		expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
		expect(png.readUInt32BE(16)).toBe(APPLE_TOUCH_ICON_SIZE);
		expect(png.readUInt32BE(20)).toBe(APPLE_TOUCH_ICON_SIZE);
	});
});

describe("FAVICON_VARIANTS", () => {
	it("gives each app a tile of its own sign-in colour: slate by default, blue for web, green for merchant", () => {
		const tiles = FAVICON_VARIANTS.map((variant: FaviconVariant): string => {
			const match = /<rect [^>]*fill="(?<color>#[0-9a-f]{6})"/u.exec(renderFaviconSvg(TOKEN_SOURCE, variant));
			return match?.groups?.color ?? "";
		});

		expect(FAVICON_VARIANTS.map((variant: FaviconVariant): string => variant.suffix)).toStrictEqual(["", "-blue", "-green"]);
		expect(new Set(tiles).size).toBe(FAVICON_VARIANTS.length);
	});
});
