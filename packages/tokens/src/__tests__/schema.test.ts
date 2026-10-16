import { describe, expect, it } from "vitest";

import { PALETTE } from "./palette";
import {
	ColorValueSchema,
	CubicBezierSchema,
	HexColorSchema,
	LengthSchema,
	OklchColorSchema,
	PaletteReferenceSchema,
	PaletteSchema,
	ShadowSchema,
	StackLevelSchema,
	TailwindAliasSchema,
	ThemeSchema,
	ThemesSchema,
	TokenSourceSchema,
} from "./schema";
import { DARK_THEME, LIGHT_THEME, THEMES } from "./semantic";
import { TOKEN_SOURCE } from "./source";
import { colorToken, oklch } from "./value";

describe("the committed token source", () => {
	it("parses against the token schema", () => {
		expect(TokenSourceSchema.safeParse(TOKEN_SOURCE).success).toBe(true);
	});
});

describe("ThemeSchema", () => {
	it("rejects a theme that is missing a role", () => {
		const { card: removedCard, ...darkWithoutCard } = DARK_THEME;

		const result = ThemeSchema.safeParse(darkWithoutCard);

		expect(result.success).toBe(false);
		expect(result.error?.issues.map(({ path }) => path.join("."))).toContain("card");
	});

	it("rejects a role the role list does not define", () => {
		expect(ThemeSchema.safeParse({ ...LIGHT_THEME, "brand-new-role": oklch(0.5, 0, 0) }).success).toBe(false);
	});

	it("makes the whole source fail when one theme lacks a role another theme defines", () => {
		const { "sidebar-ring": removedSidebarRing, ...lightWithoutSidebarRing } = LIGHT_THEME;

		const result = TokenSourceSchema.safeParse({ ...TOKEN_SOURCE, themes: { ...THEMES, light: lightWithoutSidebarRing } });

		expect(result.error?.issues.map(({ path }) => path.join("."))).toContain("themes.light.sidebar-ring");
	});

	it("rejects a source without one of the themes", () => {
		expect(ThemesSchema.safeParse({ light: LIGHT_THEME }).success).toBe(false);
	});
});

describe("PaletteSchema", () => {
	it("rejects a scale that is missing a step", () => {
		const { "500": removedStep, ...warmWithoutMiddle } = PALETTE.warm;

		expect(PaletteSchema.safeParse({ ...PALETTE, warm: warmWithoutMiddle }).success).toBe(false);
	});

	it("rejects a step the scale does not define", () => {
		expect(PaletteSchema.safeParse({ ...PALETTE, warm: { ...PALETTE.warm, "400": oklch(0.7, 0.12, 66) } }).success).toBe(false);
	});

	it("rejects a colour keyword as a palette step (primitives are literal colours)", () => {
		expect(PaletteSchema.safeParse({ ...PALETTE, warm: { ...PALETTE.warm, "300": { kind: "keyword", value: "transparent" } } }).success).toBe(false);
	});
});

describe("PaletteReferenceSchema", () => {
	it("accepts a step that exists on the referenced scale", () => {
		expect(PaletteReferenceSchema.safeParse({ kind: "palette", scale: "warm", step: "500" }).success).toBe(true);
	});

	it("rejects a step that exists only on another scale", () => {
		expect(PaletteReferenceSchema.safeParse({ kind: "palette", scale: "warm", step: "50" }).success).toBe(false);
	});
});

describe("OklchColorSchema", () => {
	it.each([
		["lightness above 1", { kind: "oklch", lightness: 1.2, chroma: 0, hue: 0 }],
		["negative chroma", { kind: "oklch", lightness: 0.5, chroma: -0.1, hue: 0 }],
		["hue above 360", { kind: "oklch", lightness: 0.5, chroma: 0.1, hue: 361 }],
		["alpha above 1", { kind: "oklch", lightness: 0.5, chroma: 0.1, hue: 10, alpha: 2 }],
		["an unknown field", { kind: "oklch", lightness: 0.5, chroma: 0.1, hue: 10, gamut: "p3" }],
	])("rejects %s", (_label, color) => {
		expect(OklchColorSchema.safeParse(color).success).toBe(false);
	});

	it("accepts a colour with an alpha channel", () => {
		expect(OklchColorSchema.safeParse(oklch(0.24, 0.02, 258, 0.06)).success).toBe(true);
	});
});

describe("HexColorSchema", () => {
	it.each(["#F1F4F9", "#fff", "f1f4f9", "#f1f4f9aa"])("rejects %s (only six lowercase digits are canonical)", (value) => {
		expect(HexColorSchema.safeParse({ kind: "hex", value }).success).toBe(false);
	});

	it("accepts a six-digit lowercase hex colour", () => {
		expect(HexColorSchema.safeParse({ kind: "hex", value: "#f1f4f9" }).success).toBe(true);
	});
});

describe("ColorValueSchema", () => {
	it("rejects a reference to a token that does not exist", () => {
		expect(ColorValueSchema.safeParse({ kind: "token", name: "not-a-token" }).success).toBe(false);
	});

	it("accepts a reference to a shared colour token", () => {
		expect(ColorValueSchema.safeParse(colorToken("scrim")).success).toBe(true);
	});
});

describe("non-colour value schemas", () => {
	it("rejects a length that is not finite", () => {
		expect(LengthSchema.safeParse({ kind: "length", value: Number.POSITIVE_INFINITY, unit: "rem" }).success).toBe(false);
	});

	it("rejects an unsupported length unit", () => {
		expect(LengthSchema.safeParse({ kind: "length", value: 1, unit: "em" }).success).toBe(false);
	});

	it("rejects a fractional or negative stack level", () => {
		expect(StackLevelSchema.safeParse({ kind: "stack-level", value: 1.5 }).success).toBe(false);
		expect(StackLevelSchema.safeParse({ kind: "stack-level", value: -1 }).success).toBe(false);
	});

	it("rejects a cubic-bezier whose x control point leaves 0–1", () => {
		expect(CubicBezierSchema.safeParse({ kind: "cubic-bezier", x1: 1.2, y1: 0, x2: 0.5, y2: 1 }).success).toBe(false);
	});

	it("rejects a shadow with no layers", () => {
		expect(ShadowSchema.safeParse({ name: "shadow-none", layers: [] }).success).toBe(false);
	});

	it("rejects a Tailwind theme name that is not a lowercase CSS identifier", () => {
		expect(TailwindAliasSchema.safeParse({ name: "Z Index", token: "z-toast" }).success).toBe(false);
	});
});
