import { describe, expect, it } from "vitest";

import { ColorReferenceCycleError, createColorLookups, resolveColorToken, resolveColorValue, UnknownColorTokenError, UnknownPaletteStepError } from "./resolve";
import type { ColorLookups } from "./resolve";
import type { ColorValue } from "./schema";
import { TOKEN_SOURCE } from "./source";
import { colorToken, hex, oklch, paletteColor } from "./value";

function buildLookups(overrides: Partial<ColorLookups> = {}): ColorLookups {
	return { palette: new Map(), colors: new Map(), ...overrides };
}

describe("resolveColorToken", () => {
	it("returns a literal colour as written", () => {
		expect(resolveColorToken(TOKEN_SOURCE, "light", "destructive")).toBe("oklch(0.577 0.245 27.325)");
	});

	it("follows a palette reference to the palette step's colour", () => {
		expect(resolveColorToken(TOKEN_SOURCE, "light", "background")).toBe("#f1f4f9");
		expect(resolveColorToken(TOKEN_SOURCE, "dark", "background")).toBe("oklch(0.225 0.015 258)");
	});

	it("follows a token reference within the theme (reward → tier-gold)", () => {
		expect(resolveColorToken(TOKEN_SOURCE, "dark", "reward")).toBe("oklch(0.87 0.13 88)");
	});

	it("resolves a shared colour against the theme it is read in (invert → foreground)", () => {
		expect(resolveColorToken(TOKEN_SOURCE, "light", "invert")).toBe("oklch(0.24 0.02 258)");
		expect(resolveColorToken(TOKEN_SOURCE, "dark", "invert")).toBe("oklch(0.965 0.004 258)");
	});

	it("keeps the transparent keyword", () => {
		expect(resolveColorToken(TOKEN_SOURCE, "light", "edge-highlight")).toBe("transparent");
	});
});

describe("createColorLookups", () => {
	it("keys every palette step by its variable name", () => {
		const { palette } = createColorLookups(TOKEN_SOURCE, "light");

		expect(palette.get("palette-neutral-50")).toStrictEqual(hex("#f1f4f9"));
		expect(palette.size).toBe(Object.values(TOKEN_SOURCE.palette).flatMap((steps) => Object.keys(steps)).length);
	});

	it("holds the chosen theme's roles next to the shared colours", () => {
		const { colors } = createColorLookups(TOKEN_SOURCE, "dark");

		expect(colors.get("card")).toStrictEqual(paletteColor("ink", "750"));
		expect(colors.get("scrim")).toStrictEqual(oklch(0, 0, 0));
	});
});

describe("resolveColorValue", () => {
	it("throws when tokens reference each other in a cycle", () => {
		const lookups = buildLookups({
			colors: new Map([
				["invert", colorToken("foreground")],
				["foreground", colorToken("invert")],
			]),
		});

		expect(() => resolveColorValue(colorToken("invert"), lookups)).toThrow(ColorReferenceCycleError);
	});

	it("throws when a reference names a token the lookups do not hold", () => {
		expect(() => resolveColorValue(colorToken("scrim"), buildLookups())).toThrow(UnknownColorTokenError);
	});

	it("throws when a palette reference names a step the palette does not hold", () => {
		expect(() => resolveColorValue(paletteColor("neutral", "0"), buildLookups())).toThrow(UnknownPaletteStepError);
	});

	it("follows a chain of references to the final literal", () => {
		const lookups = buildLookups({
			palette: new Map([["palette-brand-800", oklch(0.33, 0.05, 257)]]),
			colors: new Map<string, ColorValue>([
				["reward", colorToken("tier-gold")],
				["tier-gold", paletteColor("brand", "800")],
			]),
		});

		expect(resolveColorValue(colorToken("reward"), lookups)).toStrictEqual(oklch(0.33, 0.05, 257));
	});
});
