import { describe, expect, it } from "vitest";

import { SharedColorNameSchema, ThemeRoleSchema } from "../schema";
import { TOKEN_SOURCE } from "../source";
import { readDeclarations } from "../testing/css-reader";
import { renderMobileStylesheet } from "./render-mobile";
import { renderWebStylesheet } from "./render-web";

describe("renderMobileStylesheet", () => {
	const css = renderMobileStylesheet(TOKEN_SOURCE);
	const light = readDeclarations(css, "@variant light");
	const dark = readDeclarations(css, "@variant dark");
	const theme = readDeclarations(css, "@theme inline");

	it("uses Uniwind's theme layout: @layer theme > :root > one @variant per theme", () => {
		expect(css).toContain("@layer theme {\n\t:root {\n\t\t@variant light {");
		expect(css).toContain("\t\t@variant dark {");
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
