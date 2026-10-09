// ============================================
// generator/render-palette.ts — generated/palette.css
// ============================================
// The primitives alone, for a surface that maps its OWN semantic names onto the
// shared scales (the docs site, apps/docs src/styles/global.css). The apps read
// web.css instead, which carries the same primitives.

import type { TokenSource } from "../schema";
import { paletteDeclarations, generatedNotice } from "./common";
import { printStylesheet, rule } from "./css";

export function renderPaletteStylesheet(source: TokenSource): string {
	const header = generatedNotice([
		"The palette primitives (--palette-<scale>-<step>) on their own, for a surface",
		"that maps its own semantic names onto the shared scales (apps/docs).",
		"Components never read these directly; they read the semantic tokens in web.css.",
	]);
	return printStylesheet(header, [rule(":root", paletteDeclarations(source.palette))]);
}
