// ============================================
// generator/render-palette.ts — generated/palette.css
// ============================================
// The primitives alone, for a surface that maps its OWN semantic names onto the
// shared scales (the docs site, apps/docs src/styles/global.css). The apps read
// web.css instead, which carries the same primitives. The page widths (`max-w-8xl`
// to `max-w-10xl`) ride along, so the docs and the apps never disagree on them.

import type { SizeName, TokenSource } from "../schema";
import { formatWebSize, paletteDeclarations, generatedNotice } from "./common";
import { declaration, printStylesheet, rule } from "./css";

/** The page widths the docs share with the apps; web, merchant, admin and the docs centre every page in the 10xl one. */
export const SHARED_PAGE_WIDTHS: readonly SizeName[] = ["max-width-8xl", "max-width-9xl", "max-width-10xl"];

export function renderPaletteStylesheet(source: TokenSource): string {
	const header = generatedNotice([
		"The palette primitives (--palette-<scale>-<step>) on their own, for a surface",
		"that maps its own semantic names onto the shared scales (apps/docs), plus the",
		"page widths every surface shares (--max-width-8xl / 9xl / 10xl; pages use 10xl).",
		"Components never read these directly; they read the semantic tokens in web.css.",
	]);
	return printStylesheet(header, [
		rule(":root", [...paletteDeclarations(source.palette), ...SHARED_PAGE_WIDTHS.map((name) => declaration(name, formatWebSize(source.layout.sizes[name])))]),
	]);
}
