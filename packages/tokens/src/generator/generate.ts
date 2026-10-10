// ============================================
// generator/generate.ts — the token source → every generated file (stylesheets, the favicon)
// ============================================
// Pure: returns file names and contents, writes nothing (scripts/generate.ts
// writes; the staleness test compares). Fails — throws — when the source does
// not parse (an unsupported value, a missing role, a palette step that does not
// exist), when a theme lacks a variable another theme defines, or when a block
// would declare a variable twice.

import type { GeneratedFileName, TokenSource } from "../schema";
import { GeneratedFileNameSchema, TokenSourceSchema } from "../schema";
import { FAVICON_VARIANTS, renderAppleTouchIcon, renderFaviconIco, renderFaviconSvg, type FaviconVariant } from "./render-favicon";
import { renderAppIcon, renderLaunchColorsJson, renderSplashIcon } from "./render-mobile-assets";
import { renderMobileStylesheet } from "./render-mobile";
import { renderPaletteStylesheet } from "./render-palette";
import { renderWebStylesheet } from "./render-web";

export interface GeneratedStylesheet {
	readonly fileName: GeneratedFileName;
	/** Text for the stylesheets and the SVG; bytes for the raster icons. */
	readonly contents: string | Uint8Array;
}

export function generateTokenStylesheets(input: TokenSource): readonly GeneratedStylesheet[] {
	const source = TokenSourceSchema.parse(input);
	return [
		{ fileName: "palette.css", contents: renderPaletteStylesheet(source) },
		{ fileName: "web.css", contents: renderWebStylesheet(source) },
		{ fileName: "mobile.css", contents: renderMobileStylesheet(source) },
		...FAVICON_VARIANTS.flatMap((variant: FaviconVariant): readonly GeneratedStylesheet[] => [
			{ fileName: GeneratedFileNameSchema.parse(`favicon${variant.suffix}.svg`), contents: renderFaviconSvg(source, variant) },
			{ fileName: GeneratedFileNameSchema.parse(`favicon${variant.suffix}.ico`), contents: renderFaviconIco(source, variant) },
			{ fileName: GeneratedFileNameSchema.parse(`apple-touch-icon${variant.suffix}.png`), contents: renderAppleTouchIcon(source, variant) },
		]),
		{ fileName: "app-icon.png", contents: renderAppIcon(source) },
		{ fileName: "splash-icon.png", contents: renderSplashIcon(source) },
		{ fileName: "launch-colors.json", contents: renderLaunchColorsJson(source) },
	];
}
