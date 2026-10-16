import { describe, expect, it } from "vitest";

import { TOKEN_SOURCE } from "../source";
import { readDeclarations } from "../testing/css-reader";
import { renderPaletteStylesheet } from "./render-palette";

describe("renderPaletteStylesheet", () => {
	const css = renderPaletteStylesheet(TOKEN_SOURCE);

	it("declares every palette step in :root and nothing else", () => {
		const declarations = readDeclarations(css, ":root");

		expect([...declarations.keys()].every((name) => name.startsWith("palette-"))).toBe(true);
		expect(declarations.size).toBe(Object.values(TOKEN_SOURCE.palette).flatMap((steps) => Object.keys(steps)).length);
		expect(declarations.get("palette-neutral-40")).toBe("#f5f7fb");
		expect(declarations.get("palette-blue-950")).toBe("oklch(0.25 0.065 256)");
	});

	it("starts with the generated-file header", () => {
		expect(css.startsWith("/*\n * GENERATED FILE: do not edit by hand.")).toBe(true);
	});
});
