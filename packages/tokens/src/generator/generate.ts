// ============================================
// generator/generate.ts — the token source → every generated stylesheet
// ============================================
// Pure: returns file names and contents, writes nothing (scripts/generate.ts
// writes; the staleness test compares). Fails — throws — when the source does
// not parse (an unsupported value, a missing role, a palette step that does not
// exist), when a theme lacks a variable another theme defines, or when a block
// would declare a variable twice.

import type { GeneratedFileName, TokenSource } from "../schema";
import { TokenSourceSchema } from "../schema";
import { renderMobileStylesheet } from "./render-mobile";
import { renderPaletteStylesheet } from "./render-palette";
import { renderWebStylesheet } from "./render-web";

export interface GeneratedStylesheet {
	readonly fileName: GeneratedFileName;
	readonly contents: string;
}

export function generateTokenStylesheets(input: TokenSource): readonly GeneratedStylesheet[] {
	const source = TokenSourceSchema.parse(input);
	return [
		{ fileName: "palette.css", contents: renderPaletteStylesheet(source) },
		{ fileName: "web.css", contents: renderWebStylesheet(source) },
		{ fileName: "mobile.css", contents: renderMobileStylesheet(source) },
	];
}
