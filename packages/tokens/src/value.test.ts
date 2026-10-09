import { describe, expect, it } from "vitest";

import { colorToken, cubicBezier, fontVariable, hex, oklch, paletteColor, px, rem, sizeToken, stackLevel, TRANSPARENT } from "./value";

describe("token value constructors", () => {
	it("builds an oklch colour without an alpha key when no alpha is given", () => {
		expect(oklch(0.5, 0.016, 258)).toStrictEqual({ kind: "oklch", lightness: 0.5, chroma: 0.016, hue: 258 });
	});

	it("builds an oklch colour with its alpha", () => {
		expect(oklch(0, 0, 0, 0.25)).toStrictEqual({ kind: "oklch", lightness: 0, chroma: 0, hue: 0, alpha: 0.25 });
	});

	it("builds a hex colour", () => {
		expect(hex("#f1f4f9")).toStrictEqual({ kind: "hex", value: "#f1f4f9" });
	});

	it("exposes the transparent keyword", () => {
		expect(TRANSPARENT).toStrictEqual({ kind: "keyword", value: "transparent" });
	});

	it("builds a palette reference", () => {
		expect(paletteColor("ink", "850")).toStrictEqual({ kind: "palette", scale: "ink", step: "850" });
	});

	it("builds colour and size token references", () => {
		expect(colorToken("tier-gold")).toStrictEqual({ kind: "token", name: "tier-gold" });
		expect(sizeToken("max-width-10xl")).toStrictEqual({ kind: "token", name: "max-width-10xl" });
	});

	it("builds a font variable reference", () => {
		expect(fontVariable("font-heading")).toStrictEqual({ kind: "font", name: "font-heading" });
	});

	it("builds rem and px lengths", () => {
		expect(rem(-0.15)).toStrictEqual({ kind: "length", value: -0.15, unit: "rem" });
		expect(px(18.4)).toStrictEqual({ kind: "length", value: 18.4, unit: "px" });
	});

	it("builds a stack level and an easing curve", () => {
		expect(stackLevel(60)).toStrictEqual({ kind: "stack-level", value: 60 });
		expect(cubicBezier(0.22, 1, 0.36, 1)).toStrictEqual({ kind: "cubic-bezier", x1: 0.22, y1: 1, x2: 0.36, y2: 1 });
	});
});
