import { describe, expect, it } from "vitest";

import { TOKEN_SOURCE } from "../../source";
import { readDeclarations } from "../../testing/css-reader";
import { renderPaletteStylesheet, SHARED_PAGE_WIDTHS } from "../render-palette";

describe("renderPaletteStylesheet", () => {
	const css = renderPaletteStylesheet(TOKEN_SOURCE);

	it("declares every palette step in :root, plus the shared page widths and nothing else", () => {
		const declarations = readDeclarations(css, ":root");
		const paletteNames = [...declarations.keys()].filter((name) => name.startsWith("palette-"));

		expect(paletteNames.length).toBe(Object.values(TOKEN_SOURCE.palette).flatMap((steps) => Object.keys(steps)).length);
		expect([...declarations.keys()].filter((name) => !name.startsWith("palette-"))).toEqual([...SHARED_PAGE_WIDTHS]);
		expect(declarations.get("palette-neutral-40")).toBe("#f5f7fb");
		expect(declarations.get("palette-blue-950")).toBe("oklch(0.25 0.065 256)");
	});

	it("gives the docs the apps' page widths as lengths on one 8rem step (palette.css has nothing to alias)", () => {
		const root = readDeclarations(css, ":root");
		expect([root.get("max-width-8xl"), root.get("max-width-9xl"), root.get("max-width-10xl")]).toEqual(["88rem", "96rem", "104rem"]);
	});

	it("starts with the generated-file header", () => {
		expect(css.startsWith("/*\n * GENERATED FILE: do not edit by hand.")).toBe(true);
	});
});
