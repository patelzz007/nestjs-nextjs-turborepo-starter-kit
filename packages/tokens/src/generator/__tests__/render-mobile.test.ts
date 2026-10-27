import { describe, expect, it } from "vitest";

import { AppThemeOverridesSchema, SharedColorNameSchema, ThemeRoleSchema } from "../../schema";
import { TOKEN_SOURCE } from "../../source";
import { readDeclarations } from "../../testing/css-reader";
import { renderMobileStylesheet } from "../render-mobile";
import { renderWebStylesheet } from "../render-web";

describe("renderMobileStylesheet", () => {
	const css = renderMobileStylesheet(TOKEN_SOURCE);
	const light = readDeclarations(css, "@variant light");
	const dark = readDeclarations(css, "@variant dark");
	const theme = readDeclarations(css, "@theme inline");

	it("uses Uniwind's theme layout: @layer theme > :root > one @variant per theme", () => {
		expect(css).toContain("@layer theme {\n\t:root {\n\t\t@variant light {");
		expect(css).toContain("\t\t@variant dark {");
		expect(css).toContain("\t\t@variant nord {");
	});

	it("declares the variant of every theme beyond light and dark before the first use, as Uniwind defines one", () => {
		expect(css.indexOf("@custom-variant nord (&:where(.nord, .nord *));")).toBeGreaterThan(-1);
		expect(css.indexOf("@custom-variant nord")).toBeLessThan(css.indexOf("@variant nord {"));
		expect(css).not.toContain("@custom-variant light");
		expect(css).not.toContain("@custom-variant dark");
	});

	it("declares the same variables, in the same order, in every variant", () => {
		expect([...dark.keys()]).toStrictEqual([...light.keys()]);
	});

	it("declares every colour token with a literal value, never a var() chain", () => {
		const colorNames = [...ThemeRoleSchema.options, ...SharedColorNameSchema.options];

		expect(colorNames.filter((name) => !light.has(name))).toStrictEqual([]);
		expect([...light.values(), ...dark.values()].filter((value) => value.includes("var("))).toStrictEqual([]);
	});

	it("resolves each value for its own theme", () => {
		expect(light.get("background")).toBe("#f1f4f9");
		expect(dark.get("background")).toBe("oklch(0.225 0.015 258)");
		expect(light.get("invert")).toBe("oklch(0.24 0.02 258)");
		expect(dark.get("invert")).toBe("oklch(0.965 0.004 258)");
	});

	it("carries the radius and the type sizes, and none of the web-chrome tokens", () => {
		expect(light.get("radius")).toBe("0.625rem");
		expect(light.get("text-kbd")).toBe("0.625rem");
		expect(light.has("z-toast")).toBe(false);
		expect(light.has("sidebar-width")).toBe(false);
		expect(light.has("palette-neutral-0")).toBe(false);
	});

	it("maps the same colour utilities as the web, and the radius scale as literal lengths", () => {
		const webTheme = readDeclarations(renderWebStylesheet(TOKEN_SOURCE), "@theme inline");
		const webColorUtilities = [...webTheme].filter(([name]) => name.startsWith("color-"));

		expect([...theme].filter(([name]) => name.startsWith("color-"))).toStrictEqual(webColorUtilities);
		expect(theme.get("radius-sm")).toBe("0.25rem");
		expect(theme.get("radius-lg")).toBe("0.625rem");
		expect(theme.get("radius-3xl")).toBe("1.375rem");
	});
});

describe("the mobile app's brand re-maps (MOBILE_THEME_OVERRIDES)", () => {
	const mobile = renderMobileStylesheet(TOKEN_SOURCE);
	const web = renderWebStylesheet(TOKEN_SOURCE);

	it("fills Nord's buttons and active items with Snow Storm (nord6) and Polar Night text on mobile only", () => {
		const nord = readDeclarations(mobile, "@variant nord");
		expect(nord.get("primary")).toBe("#eceff4");
		expect(nord.get("primary-foreground")).toBe("#2e3440");
		expect(nord.get("sidebar-active")).toBe("#eceff4");
		// Links keep a colour of their own: Frost, not the near-white of the buttons and body text.
		expect(nord.get("link")).toBe("#94c6d4");
		expect(readDeclarations(web, ".nord").get("primary")).toBe("var(--palette-vivid-9)");
	});

	it("leaves light and dark exactly as the shared themes", () => {
		expect(readDeclarations(mobile, "@variant dark").get("primary")).toBe(
			readDeclarations(renderMobileStylesheet({ ...TOKEN_SOURCE, mobileThemeOverrides: {} }), "@variant dark").get("primary"),
		);
	});

	it("accepts brand roles only — surfaces, borders and text are never re-mapped per app", () => {
		expect(AppThemeOverridesSchema.safeParse({ nord: { background: { kind: "hex", value: "#000000" } } }).success).toBe(false);
		expect(AppThemeOverridesSchema.safeParse({ nord: { primary: { kind: "hex", value: "#000000" } } }).success).toBe(true);
	});
});
