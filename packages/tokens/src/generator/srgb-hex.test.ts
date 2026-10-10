import { describe, expect, it } from "vitest";

import { oklch } from "../value";
import { ColorHasNoHexError, formatSrgbHex } from "./srgb-hex";

describe("formatSrgbHex", () => {
	it.each([
		[oklch(1, 0, 0), "#ffffff"],
		[oklch(0, 0, 0), "#000000"],
		[oklch(0.628, 0.2577, 29.23), "#ff0000"],
		[oklch(0.22, 0.035, 257), "#101b2b"],
	])("converts %o to %s", (color, expected) => {
		expect(formatSrgbHex(color)).toBe(expected);
	});

	it("passes a hex colour through", () => {
		expect(formatSrgbHex({ kind: "hex", value: "#f1f4f9" })).toBe("#f1f4f9");
	});

	it("clamps colours outside the sRGB gamut instead of wrapping", () => {
		expect(formatSrgbHex(oklch(0.9, 0.4, 145))).toMatch(/^#[0-9a-f]{6}$/u);
	});

	it("refuses a keyword, which has no single sRGB value", () => {
		expect(() => formatSrgbHex({ kind: "keyword", value: "transparent" })).toThrow(ColorHasNoHexError);
	});
});
