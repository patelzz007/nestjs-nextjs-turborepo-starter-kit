import { describe, expect, it } from "vitest";

import { ThemeRoleSchema } from "../schema";
import { TOKEN_SOURCE } from "../source";
import { readDeclarations } from "../testing/css-reader";
import { renderWebStylesheet } from "./render-web";

describe("renderWebStylesheet", () => {
	const css = renderWebStylesheet(TOKEN_SOURCE);
	const root = readDeclarations(css, ":root");
	const dark = readDeclarations(css, ".dark");
	const theme = readDeclarations(css, "@theme inline");

	it("writes the dark theme as exactly the themed roles, in role order", () => {
		expect([...dark.keys()]).toStrictEqual(ThemeRoleSchema.options);
	});

	it("writes every themed role in :root too (the light theme), so .dark only ever overrides", () => {
		expect(ThemeRoleSchema.options.filter((role) => !root.has(role))).toStrictEqual([]);
	});

	it("puts the palette, the theme-independent tokens and the light theme in :root", () => {
		expect(root.get("palette-neutral-0")).toBe("oklch(1 0 0)");
		expect(root.get("z-toast")).toBe("60");
		expect(root.get("panel-content-max-width")).toBe("var(--max-width-10xl)");
		expect(root.get("font-button")).toBe("var(--font-sans)");
		expect(root.get("ease-drawer-content")).toBe("cubic-bezier(0.45, 1.005, 0, 1.005)");
		expect(root.get("invert")).toBe("var(--foreground)");
		expect(root.get("radius")).toBe("0.625rem");
		expect(root.get("background")).toBe("var(--palette-neutral-50)");
	});

	it("keeps references as var() in the dark theme", () => {
		expect(dark.get("background")).toBe("var(--palette-ink-850)");
		expect(dark.get("reward")).toBe("var(--tier-gold)");
		expect(dark.get("shadow-key")).toBe("oklch(0 0 0 / 0.45)");
	});

	it("maps tokens to Tailwind utilities in @theme inline", () => {
		expect(theme.get("color-card")).toBe("var(--card)");
		expect(theme.get("z-index-toast")).toBe("var(--z-toast)");
		expect(theme.get("shadow-sm")).toBe("0 1px 3px 0 var(--shadow-ambient), 0 1px 2px -1px var(--shadow-ambient)");
		expect(theme.get("inset-shadow-edge")).toBe("inset 0 1px 0 0 var(--edge-highlight)");
		expect(theme.get("radius-lg")).toBe("var(--radius)");
		expect(theme.get("radius-3xl")).toBe("calc(var(--radius) * 2.2)");
		expect(theme.get("font-heading")).toBe("var(--font-heading)");
	});

	it("exposes every colour utility it maps as a variable it declares", () => {
		const colorUtilities = [...theme.keys()].filter((name) => name.startsWith("color-")).map((name) => name.slice("color-".length));

		expect(colorUtilities.filter((name) => !root.has(name))).toStrictEqual([]);
	});
});
