import { describe, expect, it } from "vitest";

import { hex, oklch, px, rem, stackLevel, TRANSPARENT, cubicBezier, colorToken } from "../value";
import {
	formatColorLiteral,
	formatCubicBezier,
	formatLength,
	formatNumber,
	formatPixels,
	formatShadowLayer,
	formatStackLevel,
	formatVariableReference,
	paletteVariableName,
} from "./format";

describe("formatNumber", () => {
	it.each([
		[0.5, "0.5"],
		[258, "258"],
		[-0.15, "-0.15"],
		[264.665, "264.665"],
		[0.625 * 2.2, "1.375"],
		[-0, "0"],
		[-0.0000001, "0"],
	])("writes %d as %s", (value, expected) => {
		expect(formatNumber(value)).toBe(expected);
	});
});

describe("formatColorLiteral", () => {
	it("writes an oklch colour with space-separated channels", () => {
		expect(formatColorLiteral(oklch(0.577, 0.245, 27.325))).toBe("oklch(0.577 0.245 27.325)");
	});

	it("writes the alpha after a slash", () => {
		expect(formatColorLiteral(oklch(0.24, 0.02, 258, 0.06))).toBe("oklch(0.24 0.02 258 / 0.06)");
	});

	it("writes hex colours and keywords as they are", () => {
		expect(formatColorLiteral(hex("#f5f7fb"))).toBe("#f5f7fb");
		expect(formatColorLiteral(TRANSPARENT)).toBe("transparent");
	});
});

describe("non-colour formatters", () => {
	it("writes lengths with their unit", () => {
		expect(formatLength(rem(20))).toBe("20rem");
		expect(formatLength(px(18.4))).toBe("18.4px");
		expect(formatLength(rem(-0.15))).toBe("-0.15rem");
	});

	it("writes a zero pixel offset bare and any other offset in px", () => {
		expect(formatPixels(0)).toBe("0");
		expect(formatPixels(-2)).toBe("-2px");
	});

	it("writes a cubic-bezier with comma-separated points", () => {
		expect(formatCubicBezier(cubicBezier(0.45, 1.005, 0, 1.005))).toBe("cubic-bezier(0.45, 1.005, 0, 1.005)");
	});

	it("writes a stack level as a bare integer", () => {
		expect(formatStackLevel(stackLevel(50))).toBe("50");
	});

	it("writes variable references and palette variable names", () => {
		expect(formatVariableReference("card")).toBe("var(--card)");
		expect(paletteVariableName("neutral", "50")).toBe("palette-neutral-50");
	});
});

describe("formatShadowLayer", () => {
	it("writes a drop shadow layer", () => {
		expect(formatShadowLayer({ isInset: false, offsetX: 0, offsetY: 1, blur: 2, spread: -1, color: colorToken("shadow-ambient") })).toBe(
			"0 1px 2px -1px var(--shadow-ambient)",
		);
	});

	it("prefixes an inset layer", () => {
		expect(formatShadowLayer({ isInset: true, offsetX: 0, offsetY: 1, blur: 0, spread: 0, color: colorToken("edge-highlight") })).toBe(
			"inset 0 1px 0 0 var(--edge-highlight)",
		);
	});
});
