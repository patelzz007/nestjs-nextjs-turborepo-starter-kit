import { describe, expect, it } from "vitest";

import { readCssNumber, parseColor } from "../color-parse";
import { formatColor } from "../color-format";

function hexOf(input: string): string | null {
	const color = parseColor(input);
	return color === null ? null : formatColor(color, "hex");
}

describe("parseColor", () => {
	it("reads hex with 3, 4, 6 and 8 digits, with or without #", (): void => {
		expect(parseColor("#f00")).toStrictEqual({ space: "rgb", channels: [255, 0, 0], alpha: 1 });
		expect(parseColor("00ff00")).toStrictEqual({ space: "rgb", channels: [0, 255, 0], alpha: 1 });
		expect(parseColor("#0000ff80")?.alpha).toBeCloseTo(128 / 255);
		expect(parseColor("#f008")?.alpha).toBeCloseTo(136 / 255);
	});

	it("reads named colours and transparent, ignoring case and whitespace", (): void => {
		expect(hexOf("  RebeccaPurple ")).toBe("#663399");
		expect(parseColor("transparent")).toStrictEqual({ space: "rgb", channels: [0, 0, 0], alpha: 0 });
	});

	it("reads rgb() in modern and comma syntax, with alpha", (): void => {
		expect(parseColor("rgb(10 20 30)")).toStrictEqual({ space: "rgb", channels: [10, 20, 30], alpha: 1 });
		expect(parseColor("rgba(10, 20, 30, 0.5)")).toStrictEqual({ space: "rgb", channels: [10, 20, 30], alpha: 0.5 });
		expect(parseColor("rgb(100% 50% 0% / 25%)")).toStrictEqual({ space: "rgb", channels: [255, 127.5, 0], alpha: 0.25 });
	});

	it("keeps hsl, hsb and oklch channels in their own space and wraps the hue", (): void => {
		expect(parseColor("hsl(390 50% 40%)")).toStrictEqual({ space: "hsl", channels: [30, 50, 40], alpha: 1 });
		expect(parseColor("hsb(0.5turn 100% 100%)")).toStrictEqual({ space: "hsv", channels: [180, 100, 100], alpha: 1 });
		expect(parseColor("oklch(62.8% 0.2577 -330)")).toStrictEqual({ space: "oklch", channels: [62.8, 0.2577, 30], alpha: 1 });
	});

	it("reads hwb(), lab(), lch(), oklab() and color()", (): void => {
		expect(hexOf("hwb(0 0% 0%)")).toBe("#ff0000");
		expect(hexOf("hwb(0 60% 60%)")).toBe("#808080");
		expect(hexOf("lab(54.29 80.8 69.89)")).toBe("#ff0000");
		expect(hexOf("lch(54.29 106.84 40.86)")).toBe("#ff0000");
		expect(hexOf("oklab(0.628 0.2249 0.1258)")).toBe("#ff0000");
		expect(parseColor("color(srgb 1 0 0)")).toStrictEqual({ space: "rgb", channels: [255, 0, 0], alpha: 1 });
		expect(parseColor("color(display-p3 1 0 0)")?.space).toBe("oklch");
		expect(hexOf("color(xyz-d65 0.4124 0.2126 0.0193)")).toBe("#ff0000");
	});

	it("returns null for anything it cannot read", (): void => {
		expect(parseColor(null)).toBeNull();
		expect(parseColor(undefined)).toBeNull();
		expect(parseColor("")).toBeNull();
		expect(parseColor("var(--primary)")).toBeNull();
		expect(parseColor("currentColor")).toBeNull();
		expect(parseColor("rgb(1 2)")).toBeNull();
		expect(parseColor("rgb(1 2 3 / 4 / 5)")).toBeNull();
		expect(parseColor("hsl(10% 50% 50%)")).toBeNull();
		expect(parseColor("color(nope 1 0 0)")).toBeNull();
		expect(parseColor("#12345")).toBeNull();
	});
});

describe("readCssNumber", () => {
	it("scales percentages, converts angle units only where allowed, and reads none as 0", (): void => {
		expect(readCssNumber("50%", 255)).toBe(127.5);
		expect(readCssNumber("1turn", 1, true)).toBe(360);
		expect(readCssNumber("100grad", 1, true)).toBe(90);
		expect(readCssNumber("1rad", 1, true)).toBeCloseTo(57.2958);
		expect(readCssNumber("10deg", 1)).toBeNull();
		expect(readCssNumber("none", 1)).toBe(0);
		expect(readCssNumber(undefined, 1)).toBeNull();
		expect(readCssNumber("abc", 1)).toBeNull();
	});
});
