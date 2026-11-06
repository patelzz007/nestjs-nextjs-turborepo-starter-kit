import { describe, expect, it } from "vitest";

import { AppThemeOverridesSchema, MobileComponentColorNameSchema, MobileThemeOverridesSchema, SharedColorNameSchema, ThemeRoleSchema, type ThemeName } from "../../schema";
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
		expect(light.get("background")).toBe("#e7f3fb");
		expect(dark.get("background")).toBe("#1c1d20");
		expect(light.get("invert")).toBe("#1e293b");
		expect(dark.get("invert")).toBe("#f0f1f4");
	});

	it("carries the radius and the type sizes, and none of the web-chrome tokens", () => {
		expect(light.get("radius")).toBe("0.625rem");
		expect(light.get("text-kbd")).toBe("0.625rem");
		expect(light.has("z-toast")).toBe(false);
		expect(light.has("sidebar-width")).toBe(false);
		expect(light.has("palette-neutral-0")).toBe(false);
	});

	it("maps the web's colour utilities plus the mobile component colours, and the radius scale as literal lengths", () => {
		const webTheme = readDeclarations(renderWebStylesheet(TOKEN_SOURCE), "@theme inline");
		const webColorUtilities = [...webTheme].filter(([name]) => name.startsWith("color-"));
		const componentUtilities = MobileComponentColorNameSchema.options.map((name): [string, string] => [`color-${name}`, `var(--${name})`]);

		expect([...theme].filter(([name]) => name.startsWith("color-"))).toStrictEqual([...webColorUtilities, ...componentUtilities]);
		expect(theme.get("radius-sm")).toBe("0.25rem");
		expect(theme.get("radius-lg")).toBe("0.625rem");
		expect(theme.get("radius-3xl")).toBe("1.375rem");
	});
});

/** The themes whose tab bar keeps the look it shipped with (dark and Nord follow their mobile surfaces). */
const TAB_BAR_KEPT_THEMES: readonly ThemeName[] = ["light"];

describe("the mobile app's own visual system (MOBILE_THEME_OVERRIDES, ADR 079)", () => {
	const mobile = renderMobileStylesheet(TOKEN_SOURCE);
	const web = renderWebStylesheet(TOKEN_SOURCE);
	/** The stylesheet the mobile app had before it had its own system: the shared themes, no re-maps. */
	const shared = renderMobileStylesheet({ ...TOKEN_SOURCE, mobileThemeOverrides: {} });

	it("gives light its own neutral surfaces and slate ink, dark its graphite greys, and leaves the web's untouched", () => {
		expect(readDeclarations(mobile, "@variant light").get("card")).toBe("#f2f9fd");
		expect(readDeclarations(mobile, "@variant light").get("primary")).toBe("#1e293b");
		expect(readDeclarations(mobile, "@variant dark").get("card")).toBe("#292b2f");
		expect(readDeclarations(web, ":root").get("background")).toBe("var(--palette-neutral-50)");
	});

	it("pins the tab bar where it keeps its shipped look: the mobile re-maps never move it", () => {
		const tabBarNames = MobileComponentColorNameSchema.options.filter((name) => name.startsWith("tab-bar"));

		for (const theme of TAB_BAR_KEPT_THEMES) {
			const variant = `@variant ${theme}`;

			for (const name of tabBarNames) {
				expect(readDeclarations(mobile, variant).get(name)).toBe(readDeclarations(shared, variant).get(name));
			}
		}
	});

	it("draws the dark and Nord tab bars in their own surfaces: the card pill and border, a bright capsule, readable icons", () => {
		const dark = readDeclarations(mobile, "@variant dark");

		const nord = readDeclarations(mobile, "@variant nord");

		expect([dark.get("tab-bar"), dark.get("tab-bar-border")]).toStrictEqual([dark.get("card"), dark.get("border")]);

		expect([dark.get("tab-bar-active"), dark.get("tab-bar-active-foreground"), dark.get("tab-bar-icon")]).toStrictEqual(["oklch(1 0 0)", "#1c1d20", "#a9adb6"]);

		expect([nord.get("tab-bar"), nord.get("tab-bar-border")]).toStrictEqual([nord.get("card"), nord.get("border")]);

		expect([nord.get("tab-bar-active"), nord.get("tab-bar-active-foreground"), nord.get("tab-bar-icon")]).toStrictEqual(["oklch(1 0 0)", "#262830", "#b8bfcb"]);
	});

	it("draws Nord as the editor slate on mobile only, read at a glance: bright text, white buttons and active items", () => {
		const nord = readDeclarations(mobile, "@variant nord");
		expect(nord.get("background")).toBe("#2b2d36");
		expect(nord.get("card")).toBe("#303540");
		expect(nord.get("border")).toBe("#3b4150");
		expect(nord.get("foreground")).toBe("#e6e9f0");
		expect(nord.get("muted-foreground")).toBe("#b8bfcb");
		expect(nord.get("primary")).toBe("oklch(1 0 0)");
		expect(nord.get("sidebar-active")).toBe("oklch(1 0 0)");
		expect(nord.get("link")).toBe("#8da7ca");
		expect(readDeclarations(web, ".nord").get("primary")).toBe("var(--palette-vivid-9)");
	});

	it("gives checkbox and radio rings their own colour: a stronger grey than the fields in light, the fields' own in dark", () => {
		const light = readDeclarations(mobile, "@variant light");
		const dark = readDeclarations(mobile, "@variant dark");
		expect([light.get("control-ring"), light.get("input")]).toStrictEqual(["#8c8c8c", "#c7c7c7"]);
		expect(dark.get("control-ring")).toBe(dark.get("input"));
	});

	it("puts an original (full-colour) logo on a light chip in every theme, so near-black brand logos still read", () => {
		expect(readDeclarations(mobile, "@variant light").get("logo-tile")).toBe("#e5f2fb");
		expect(readDeclarations(mobile, "@variant dark").get("logo-tile")).toBe("oklch(0.87 0 0)");
		expect(readDeclarations(mobile, "@variant nord").get("logo-tile")).toBe("#e6e9f0");
	});

	it("lets the mobile app re-map any themed role, while a web app may re-map its brand roles only", () => {
		expect(MobileThemeOverridesSchema.safeParse({ nord: { background: { kind: "hex", value: "#000000" } } }).success).toBe(true);
		expect(AppThemeOverridesSchema.safeParse({ nord: { background: { kind: "hex", value: "#000000" } } }).success).toBe(false);
		expect(AppThemeOverridesSchema.safeParse({ nord: { primary: { kind: "hex", value: "#000000" } } }).success).toBe(true);
	});

	it("never writes the component colours into the web stylesheet", () => {
		expect(web).not.toContain("--tab-bar");
	});
});
