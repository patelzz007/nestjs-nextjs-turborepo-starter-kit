import { describe, expect, it } from "vitest";

import {
	AppThemeOverridesSchema,
	MobileComponentColorNameSchema,
	MobileRadiusNameSchema,
	MobileTextRoleSchema,
	MobileThemeOverridesSchema,
	SharedColorNameSchema,
	TextSizeNameSchema,
	ThemeRoleSchema,
	type ThemeName,
} from "../../schema";
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
		expect(light.get("background")).toBe("#f7f9fc");
		expect(dark.get("background")).toBe("#111827");
		expect(light.get("invert")).toBe("#172033");
		expect(dark.get("invert")).toBe("#f1f5f9");
	});

	it("carries the radius, and none of the web-chrome tokens (the web's chrome type sizes included: the phone has its own scale)", () => {
		expect(light.get("radius")).toBe("0.625rem");
		expect(TextSizeNameSchema.options.filter((name) => light.has(name))).toStrictEqual([]);
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

	it("gives every phone type role one utility, its size and line height together (the mobile visual spec)", () => {
		expect(MobileTextRoleSchema.options.filter((role) => !theme.has(`text-${role}`) || !theme.has(`text-${role}--line-height`))).toStrictEqual([]);
		const sizes = (role: string): readonly (string | undefined)[] => [theme.get(`text-${role}`), theme.get(`text-${role}--line-height`)];
		expect(sizes("display")).toStrictEqual(["32px", "40px"]);
		expect(sizes("h1")).toStrictEqual(["28px", "36px"]);
		expect(sizes("h2")).toStrictEqual(["24px", "32px"]);
		expect(sizes("h3")).toStrictEqual(["20px", "28px"]);
		expect(sizes("h4")).toStrictEqual(["16px", "24px"]);
		expect(sizes("body-lg")).toStrictEqual(["16px", "24px"]);
		expect(sizes("body")).toStrictEqual(["14px", "21px"]);
		expect(sizes("label")).toStrictEqual(["13px", "18px"]);
		expect(sizes("caption")).toStrictEqual(["12px", "16px"]);
		expect(sizes("button")).toStrictEqual(["15px", "20px"]);
		expect(sizes("nav")).toStrictEqual(["12px", "16px"]);
		expect(sizes("overline")).toStrictEqual(["11px", "16px"]);
	});

	it("gives buttons, cards and large cards their own radius", () => {
		expect(MobileRadiusNameSchema.options.map((name) => theme.get(`radius-${name}`))).toStrictEqual(["10px", "12px", "16px"]);
	});

	it("never writes the phone's type roles or radii into the web stylesheet", () => {
		const web = renderWebStylesheet(TOKEN_SOURCE);
		expect(web).not.toContain("--text-h1");
		expect(web).not.toContain("--radius-card");
	});
});

/** The themes whose tab bar keeps the look it shipped with (dark and Nord follow their mobile surfaces). */
const TAB_BAR_KEPT_THEMES: readonly ThemeName[] = ["light"];

describe("the mobile app's own visual system (MOBILE_THEME_OVERRIDES, ADR 079)", () => {
	const mobile = renderMobileStylesheet(TOKEN_SOURCE);
	const web = renderWebStylesheet(TOKEN_SOURCE);
	/** The stylesheet the mobile app had before it had its own system: the shared themes, no re-maps. */
	const shared = renderMobileStylesheet({ ...TOKEN_SOURCE, mobileThemeOverrides: {} });

	it("gives light and dark the spec's slate surfaces and ink, and leaves the web's untouched (the admin keeps graphite)", () => {
		expect(readDeclarations(mobile, "@variant light").get("card")).toBe("#ffffff");
		expect(readDeclarations(mobile, "@variant light").get("primary")).toBe("#1e293b");
		expect(readDeclarations(mobile, "@variant dark").get("card")).toBe("#1b2636");
		expect(readDeclarations(web, ":root").get("background")).toBe("var(--palette-neutral-50)");
		expect(web).not.toContain("#1b2636");
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

		expect([dark.get("tab-bar-active"), dark.get("tab-bar-active-foreground"), dark.get("tab-bar-icon")]).toStrictEqual(["#ffffff", "#0f172a", "#94a3b8"]);

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
		expect(readDeclarations(mobile, "@variant light").get("logo-tile")).toBe("#f0f4f8");
		expect(readDeclarations(mobile, "@variant dark").get("logo-tile")).toBe("oklch(0.87 0 0)");
		expect(readDeclarations(mobile, "@variant nord").get("logo-tile")).toBe("#e6e9f0");
	});

	it("draws light as the spec's slate: a cool page, white surfaces, soft fills, faint dividers, deep slate text", () => {
		const light = readDeclarations(mobile, "@variant light");
		expect([light.get("background"), light.get("card"), light.get("secondary"), light.get("border"), light.get("foreground"), light.get("muted-foreground")]).toStrictEqual([
			"#f7f9fc",
			"#ffffff",
			"#f0f4f8",
			"#e2e8f0",
			"#172033",
			// The spec's #64748b 4% deeper: #64748b is 4.31:1 on the soft fills, short of AA (owner's call, 2026-11-15).
			"#606f85",
		]);
		expect([light.get("primary"), light.get("primary-foreground"), light.get("success"), light.get("warning"), light.get("destructive")]).toStrictEqual([
			"#1e293b",
			"oklch(1 0 0)",
			"#16a34a",
			"#d97706",
			"#dc2626",
		]);
	});

	it("draws dark as the spec's slate: a deep page, lifted surfaces, white buttons with slate-900 labels", () => {
		const dark = readDeclarations(mobile, "@variant dark");
		expect([dark.get("background"), dark.get("card"), dark.get("secondary"), dark.get("border"), dark.get("foreground"), dark.get("muted-foreground")]).toStrictEqual([
			"#111827",
			"#1b2636",
			"#263548",
			"#334155",
			"#f1f5f9",
			"#94a3b8",
		]);
		expect([dark.get("primary"), dark.get("primary-foreground"), dark.get("success"), dark.get("warning"), dark.get("destructive")]).toStrictEqual([
			"#ffffff",
			"#0f172a",
			"#4ade80",
			"#fbbf24",
			"#f87171",
		]);
	});

	it("gives the spec's own roles (pressed, subtle, selected, icon, tertiary, disabled) to light and dark exactly", () => {
		const names = ["primary-pressed", "primary-subtle", "surface-selected", "icon", "text-tertiary", "disabled"];
		const light = readDeclarations(mobile, "@variant light");
		const dark = readDeclarations(mobile, "@variant dark");
		expect(names.map((name) => light.get(name))).toStrictEqual(["#0f172a", "#e2e8f0", "#e2e8f0", "#64748b", "#94a3b8", "#cbd5e1"]);
		expect(names.map((name) => dark.get(name))).toStrictEqual(["#e2e8f0", "#263548", "#334155", "#94a3b8", "#64748b", "#475569"]);
	});

	it("keeps the shared dark status colours on the phone's own dark palettes, so the spec's never reach them", () => {
		const sharedDark = readDeclarations(shared, "@variant dark");
		for (const theme of ["current-dark", "harbour", "mocha"]) {
			const declarations = readDeclarations(mobile, `@variant ${theme}`);
			expect(["success", "warning", "destructive"].map((name) => declarations.get(name))).toStrictEqual(
				["success", "warning", "destructive"].map((name) => sharedDark.get(name)),
			);
		}
	});

	it("puts the light accent blue on focus and the lead chart series, and keeps links on the darker blue that text needs", () => {
		const light = readDeclarations(mobile, "@variant light");
		expect([light.get("ring"), light.get("sidebar-ring"), light.get("chart-1")]).toStrictEqual(["#3b82f6", "#3b82f6", "#3b82f6"]);
		expect([light.get("link"), light.get("search-mark-bg")]).toStrictEqual(["#2563eb", "#2563eb"]);
	});

	it("gives fields no fill of their own: they take the surface they sit on (packages/ui-native lib/field-surface.ts)", () => {
		for (const theme of ["light", "dark", "nord", "current-dark", "harbour", "mocha"]) {
			expect(readDeclarations(mobile, `@variant ${theme}`).has("field")).toBe(false);
		}
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
