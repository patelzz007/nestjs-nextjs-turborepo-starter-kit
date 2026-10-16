import { describe, expect, it } from "vitest";

import { COLOR_PICKER_FORMATS, colorToCss, formatColor, getContrastRatio, getForegroundColor } from "./color-format";
import { parseColor } from "./color-parse";
import type { ColorPickerColor } from "./color-space";

const RED: ColorPickerColor = { space: "rgb", channels: [255, 0, 0], alpha: 1 };
const TRANSLUCENT_RED: ColorPickerColor = { space: "rgb", channels: [255, 0, 0], alpha: 0.5 };

describe("formatColor", () => {
	it("writes every format, adding alpha only when translucent", (): void => {
		expect(formatColor(RED, "hex")).toBe("#ff0000");
		expect(formatColor(RED, "rgb")).toBe("rgb(255 0 0)");
		expect(formatColor(RED, "hsl")).toBe("hsl(0 100% 50%)");
		expect(formatColor(RED, "hsb")).toBe("hsb(0 100% 100%)");
		expect(formatColor(RED, "oklch")).toBe("oklch(62.8% 0.25768 29.234)");
		expect(formatColor(TRANSLUCENT_RED, "hex")).toBe("#ff000080");
		expect(formatColor(TRANSLUCENT_RED, "rgb")).toBe("rgb(255 0 0 / 0.5)");
	});

	it("drops a tail that rounds to opaque", (): void => {
		expect(formatColor({ ...RED, alpha: 0.996 }, "rgb")).toBe("rgb(255 0 0)");
	});

	it("round-trips hex through OKLCH exactly", (): void => {
		for (const hex of ["#123456", "#abcdef", "#000000", "#ffffff", "#7f7f7f"]) {
			const color = parseColor(formatColor(parseColor(hex) ?? RED, "oklch"));
			expect(color === null ? null : formatColor(color, "hex")).toBe(hex);
		}
	});

	it("maps a wide-gamut OKLCH colour into sRGB for hex", (): void => {
		const p3 = parseColor("oklch(70% 0.35 150)");
		expect(p3 === null ? null : formatColor(p3, "hex")).toMatch(/^#[\da-f]{6}$/u);
	});

	it("lists the formats in menu order", (): void => {
		expect(COLOR_PICKER_FORMATS).toStrictEqual(["hex", "rgb", "hsl", "hsb", "oklch"]);
	});

	it("paints OKLCH as itself and everything else as rgb()", (): void => {
		expect(colorToCss(RED)).toBe("rgb(255 0 0)");
		expect(colorToCss({ space: "oklch", channels: [50, 0.1, 200], alpha: 1 })).toBe("oklch(50% 0.1 200)");
	});
});

describe("contrast", () => {
	it("computes the WCAG ratio and returns null for unreadable colours", (): void => {
		expect(getContrastRatio("#000", "#fff")).toBeCloseTo(21);
		expect(getContrastRatio("#fff", "#fff")).toBeCloseTo(1);
		expect(getContrastRatio("nope", "#fff")).toBeNull();
	});

	it("picks light text on dark backgrounds and dark text on light ones", (): void => {
		expect(getForegroundColor("#1e3a8a")).toBe("#ffffff");
		expect(getForegroundColor("#fef3c7")).toBe("#0a0a0a");
		expect(getForegroundColor(RED, { light: "white", dark: "black" })).toBe("white");
		expect(getForegroundColor("nope")).toBeNull();
	});
});
