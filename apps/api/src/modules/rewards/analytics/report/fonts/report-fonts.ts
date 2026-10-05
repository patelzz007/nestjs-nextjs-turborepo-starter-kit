// ============================================
// report-fonts.ts — the fonts a PDF report is drawn with, one entry per script
// ============================================
// PDF text needs an embedded font that has every glyph, and PDFKit does not
// fall back from one font to another per glyph. So a report's text is split
// into runs by Unicode script (`segmentByScript`) and each run is drawn in the
// font registered for its script. Adding a language = one entry in
// `REPORT_FONT_FAMILIES` (its code-point ranges, its two font files, licence).
//
// The fonts are Noto (SIL Open Font License 1.1), kept under
// `apps/api/assets/fonts/<family>/` with their `OFL.txt`; the files are the
// static instances published in the `@expo-google-fonts/*` packages (Google
// Fonts builds), versions and SHA-256 below.
//
// Every file is referenced by a STATIC `new URL("<relative path>", import.meta.url)`
// (one literal per file): the rspack build emits each one as an asset next to
// `dist/main.js` and rewrites the URL to point at it, and unbundled (vitest,
// tsx) the URL resolves next to this source file. Either way the location
// does not depend on the process's working directory.

/** A closed range of Unicode code points. */
export interface CodePointRange {
	readonly first: number;
	readonly last: number;
}

export type ReportFontWeight = "regular" | "bold";

export const REPORT_FONT_WEIGHTS: readonly ReportFontWeight[] = ["regular", "bold"];

/** One font file of a family. */
export interface ReportFontFile {
	/** `file:` URL of the font (see the header: a static `new URL(…, import.meta.url)`). */
	readonly url: URL;
	/** SHA-256 of the bundled file (a test checks it; the provenance is the package below). */
	readonly sha256: string;
}

/** One script's font family. */
export interface ReportFontFamily {
	/** Stable key (also the PDFKit font-name prefix). */
	readonly key: string;
	/** `familyName` the font file must report. */
	readonly familyName: string;
	/** Code points that must be drawn with this family. Empty for the fallback family. */
	readonly ranges: readonly CodePointRange[];
	readonly files: Readonly<Record<ReportFontWeight, ReportFontFile>>;
	/** The family's SIL OFL licence, shipped next to the files. */
	readonly licenceUrl: URL;
	/** Where the files come from. */
	readonly source: string;
	/** Text the family must be able to draw — checked at startup. */
	readonly sampleText: string;
}

/** Key of the family every code point outside the other families' ranges (Latin: English, Malay, digits, punctuation) uses. */
export const FALLBACK_FONT_KEY = "latin";

export const REPORT_FONT_FAMILIES: readonly ReportFontFamily[] = [
	{
		key: FALLBACK_FONT_KEY,
		familyName: "Noto Sans",
		ranges: [],
		files: {
			regular: {
				url: new URL("../../../../../../assets/fonts/noto-sans/NotoSans-Regular.ttf", import.meta.url),
				sha256: "fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614",
			},
			bold: {
				url: new URL("../../../../../../assets/fonts/noto-sans/NotoSans-Bold.ttf", import.meta.url),
				sha256: "13a813c49624ae3ba3c5c6e72c5ebffc4b9e1e6ea32f421c04069b037c6ad431",
			},
		},
		licenceUrl: new URL("../../../../../../assets/fonts/noto-sans/OFL.txt", import.meta.url),
		source: "@expo-google-fonts/noto-sans@0.4.2",
		sampleText: "Bahasa Melayu — Jualan RM 1,234.50 … “ok”",
	},
	{
		key: "tamil",
		familyName: "Noto Sans Tamil",
		ranges: [{ first: 0x0b80, last: 0x0bff }],
		files: {
			regular: {
				url: new URL("../../../../../../assets/fonts/noto-sans-tamil/NotoSansTamil-Regular.ttf", import.meta.url),
				sha256: "f26d8b66bf6f38dd9af6326a52188fa1a8a0b9b2905c4bd7e07c865f65a85d79",
			},
			bold: {
				url: new URL("../../../../../../assets/fonts/noto-sans-tamil/NotoSansTamil-Bold.ttf", import.meta.url),
				sha256: "c4abfe6f1291568247afb568fe6a666584f9bf7c91f7e163fd628abb368af316",
			},
		},
		licenceUrl: new URL("../../../../../../assets/fonts/noto-sans-tamil/OFL.txt", import.meta.url),
		source: "@expo-google-fonts/noto-sans-tamil@0.4.3",
		sampleText: "தமிழ்",
	},
	{
		key: "devanagari",
		familyName: "Noto Sans Devanagari",
		ranges: [
			{ first: 0x0900, last: 0x097f },
			{ first: 0xa8e0, last: 0xa8ff },
		],
		files: {
			regular: {
				url: new URL("../../../../../../assets/fonts/noto-sans-devanagari/NotoSansDevanagari-Regular.ttf", import.meta.url),
				sha256: "084a94d89eb54aafb93a056e15425c34fd859f6342875165d304837b3bcfc2d2",
			},
			bold: {
				url: new URL("../../../../../../assets/fonts/noto-sans-devanagari/NotoSansDevanagari-Bold.ttf", import.meta.url),
				sha256: "67f1ec9e2ac30b261090e32953b2df0adf6c942ab26ac47efb490fa7315bddab",
			},
		},
		licenceUrl: new URL("../../../../../../assets/fonts/noto-sans-devanagari/OFL.txt", import.meta.url),
		source: "@expo-google-fonts/noto-sans-devanagari@0.4.1",
		sampleText: "हिन्दी",
	},
	{
		key: "han",
		familyName: "Noto Sans SC",
		ranges: [
			{ first: 0x2e80, last: 0x2fdf },
			{ first: 0x3000, last: 0x303f },
			{ first: 0x3400, last: 0x4dbf },
			{ first: 0x4e00, last: 0x9fff },
			{ first: 0xf900, last: 0xfaff },
			{ first: 0xff00, last: 0xffef },
			{ first: 0x20000, last: 0x2a6df },
		],
		files: {
			regular: {
				url: new URL("../../../../../../assets/fonts/noto-sans-sc/NotoSansSC-Regular.ttf", import.meta.url),
				sha256: "d45f67f0a7c0ca3f256950777ce6a61cc7ce5f9696d02900cbbaac25f8aa7d16",
			},
			bold: {
				url: new URL("../../../../../../assets/fonts/noto-sans-sc/NotoSansSC-Bold.ttf", import.meta.url),
				sha256: "9a38ae0ab28cd5a256f9ea8e00dedc688aac17f7915fcb000572990afa956b96",
			},
		},
		licenceUrl: new URL("../../../../../../assets/fonts/noto-sans-sc/OFL.txt", import.meta.url),
		source: "@expo-google-fonts/noto-sans-sc@0.4.3",
		sampleText: "中文报告",
	},
];

/** A piece of text drawn with one font family. */
export interface ScriptRun {
	readonly text: string;
	readonly fontKey: string;
}

/**
 * Splits `text` into runs, each drawn with one font family:
 * - a code point inside a family's ranges belongs to that family;
 * - a "neutral" code point (space, punctuation, digits, joiners — anything in
 *   no family's ranges) stays in the current run when that family can draw it,
 *   so "中文 2026" or "हिन्दी।" stay one run; otherwise it goes to the fallback;
 * - leading neutrals join the first scripted run when it can draw them.
 * Combining marks live in their script's block, so a cluster is never split.
 */
export function segmentByScript(text: string, familyOf: (codePoint: number) => string | undefined, canDraw: (fontKey: string, codePoint: number) => boolean): ScriptRun[] {
	const keys: string[] = [];
	const characters = Array.from(text);
	const scripted = characters.map((character) => familyOf(character.codePointAt(0) ?? 0));
	characters.forEach((character, index) => {
		const codePoint = character.codePointAt(0) ?? 0;
		const own = scripted[index];
		if (own !== undefined) {
			keys.push(own);
			return;
		}
		const previous = keys.at(-1) ?? scripted.slice(index + 1).find((key) => key !== undefined);
		keys.push(previous !== undefined && canDraw(previous, codePoint) ? previous : FALLBACK_FONT_KEY);
	});
	const runs: { text: string; fontKey: string }[] = [];
	characters.forEach((character, index) => {
		const key = keys[index] ?? FALLBACK_FONT_KEY;
		const last = runs.at(-1);
		if (last?.fontKey === key) {
			last.text += character;
		} else {
			runs.push({ text: character, fontKey: key });
		}
	});
	return runs;
}

/** Letters and combining marks: they belong to a script (unlike spaces, digits, punctuation, symbols, joiners). */
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;

/**
 * The family that must draw `codePoint`: the one whose ranges contain it; the
 * fallback for any other letter or mark (Latin); `undefined` for a neutral
 * character, which follows the surrounding run (see {@link segmentByScript}).
 */
export function familyForCodePoint(families: readonly ReportFontFamily[], codePoint: number): string | undefined {
	const family = families.find((candidate) => candidate.ranges.some((range) => codePoint >= range.first && codePoint <= range.last));
	if (family !== undefined) {
		return family.key;
	}
	return LETTER_OR_MARK.test(String.fromCodePoint(codePoint)) ? FALLBACK_FONT_KEY : undefined;
}
