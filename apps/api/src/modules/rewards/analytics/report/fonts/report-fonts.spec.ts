import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { create } from "fontkit";
import { describe, expect, it } from "vitest";

import { testReportFontRegistry } from "../../../../../../test/support/report-fonts";
import { ReportFontInvalidError, ReportFontMissingError, ReportFontRegistry, reportFontName } from "./report-font-registry";
import { FALLBACK_FONT_KEY, familyForCodePoint, REPORT_FONT_FAMILIES, REPORT_FONT_WEIGHTS, segmentByScript, type ReportFontFamily } from "./report-fonts";

/** `text` segmented with the real families' ranges; `canDraw` stands in for glyph coverage. */
function segment(text: string, canDraw: (fontKey: string, codePoint: number) => boolean = (): boolean => true): [string, string][] {
	return segmentByScript(text, (codePoint) => familyForCodePoint(REPORT_FONT_FAMILIES, codePoint), canDraw).map((run) => [run.fontKey, run.text]);
}

/** The real families with every file copied into `directory` (so a test can break one copy). */
function copiedFamilies(directory: string): ReportFontFamily[] {
	const copy = (url: URL, prefix: string): URL => {
		const target = join(directory, `${prefix}-${basename(fileURLToPath(url))}`);
		copyFileSync(url, target);
		return pathToFileURL(target);
	};
	return REPORT_FONT_FAMILIES.map((family) => ({
		...family,
		licenceUrl: copy(family.licenceUrl, family.key),
		files: {
			regular: { ...family.files.regular, url: copy(family.files.regular.url, family.key) },
			bold: { ...family.files.bold, url: copy(family.files.bold.url, family.key) },
		},
	}));
}

describe("familyForCodePoint", () => {
	it("maps each script's code points to its family, other letters to the Latin fallback, punctuation to none", () => {
		const of = (character: string): string | undefined => familyForCodePoint(REPORT_FONT_FAMILIES, character.codePointAt(0) ?? 0);
		expect([of("த"), of("ि"), of("ह"), of("中"), of("。"), of("A"), of("é"), of(" "), of("1"), of("—"), of("‍")]).toEqual([
			"tamil",
			"devanagari",
			"devanagari",
			"han",
			"han",
			FALLBACK_FONT_KEY,
			FALLBACK_FONT_KEY,
			undefined,
			undefined,
			undefined,
			undefined,
		]);
	});
});

describe("segmentByScript", () => {
	it("splits mixed-script text into one run per script, keeping spaces and punctuation with the run around them", () => {
		expect(segment("Kedai 中文报告 தமிழ் हिन्दी!")).toEqual([
			["latin", "Kedai "],
			["han", "中文报告 "],
			["tamil", "தமிழ் "],
			["devanagari", "हिन्दी!"],
		]);
	});

	it("never splits a cluster: vowel signs, virama and joiners stay with their consonant", () => {
		expect(segment("क्ष‍त्रिय")).toEqual([["devanagari", "क्ष‍त्रिय"]]);
		expect(segment("கொ")).toEqual([["tamil", "கொ"]]);
	});

	it("gives leading neutrals to the first script run, and a neutral the current font cannot draw to the fallback", () => {
		expect(segment("2026 年报")).toEqual([["han", "2026 年报"]]);
		expect(segment("தமிழ் → x", (fontKey, codePoint) => fontKey !== "tamil" || codePoint !== "→".codePointAt(0))).toEqual([
			["tamil", "தமிழ் "],
			["latin", "→ x"],
		]);
	});

	it("keeps an all-Latin (English / Malay) string in one fallback run", () => {
		expect(segment("Jualan bulan ini: RM 1,234.50")).toEqual([["latin", "Jualan bulan ini: RM 1,234.50"]]);
		expect(segment("")).toEqual([]);
	});
});

describe("bundled report fonts", () => {
	it("are the exact files recorded in the registry (SHA-256), each with its SIL OFL licence", () => {
		for (const family of REPORT_FONT_FAMILIES) {
			expect(readFileSync(family.licenceUrl, "utf8")).toContain("SIL Open Font License, Version 1.1");
			for (const weight of REPORT_FONT_WEIGHTS) {
				const file = family.files[weight];
				expect(createHash("sha256").update(readFileSync(file.url)).digest("hex"), file.url.href).toBe(file.sha256);
			}
		}
	});

	it("shape Tamil and Devanagari correctly (OpenType reordering, conjuncts, ligatures)", () => {
		const glyphNames = (familyKey: string, text: string): string[] => {
			const family = REPORT_FONT_FAMILIES.find((candidate) => candidate.key === familyKey);
			const font = create(readFileSync(family?.files.regular.url ?? ""));
			if ("fonts" in font) throw new Error("expected a single font");
			return font.layout(text).glyphs.map((glyph) => glyph.name);
		};
		// தமிழ்: ழ + pulli form one glyph.
		expect(glyphNames("tamil", "தமிழ்")).toEqual(["tatamil", "matamil", "ivowelsigntamil", "lllaprehalftamil"]);
		// கொ: the two-part vowel splits around the consonant (e-sign BEFORE, aa-sign after).
		expect(glyphNames("tamil", "கொ")).toEqual(["evowelsigntamil", "katamil", "aavowelsigntamil"]);
		// हिन्दी: the i-sign is reordered before ह, न् takes its half form.
		expect(glyphNames("devanagari", "हिन्दी")).toEqual(["uni093F.03", "uni0939", "uni0928094D", "uni0926", "uni0940"]);
		// क्षत्रिय: the क्ष and त्र conjuncts, the i-sign before त्र.
		expect(glyphNames("devanagari", "क्षत्रिय")).toEqual(["uni0915094D0937", "uni093F.04", "uni0924094D0930", "uni092F"]);
	});
});

describe("ReportFontRegistry", () => {
	it("loads a regular and a bold face per family under stable PDFKit names", () => {
		const names = testReportFontRegistry()
			.allFaces()
			.map((face) => face.name);
		expect(names).toEqual(REPORT_FONT_FAMILIES.flatMap((family) => REPORT_FONT_WEIGHTS.map((weight) => reportFontName(family.key, weight))));
	});

	it("segments with the real fonts' coverage", () => {
		expect(testReportFontRegistry().segment("Bahasa Melayu · 中文 · தமிழ் · हिन्दी")).toEqual([
			{ text: "Bahasa Melayu · ", fontKey: "latin" },
			{ text: "中文 · ", fontKey: "han" },
			{ text: "தமிழ் · ", fontKey: "tamil" },
			{ text: "हिन्दी", fontKey: "devanagari" },
		]);
	});

	it("refuses to start when a font file is missing", () => {
		const directory = mkdtempSync(join(tmpdir(), "report-fonts-"));
		try {
			const families = copiedFamilies(directory);
			const tamilBold = families.find((family) => family.key === "tamil")?.files.bold.url ?? new URL("file:///missing");
			rmSync(tamilBold);
			expect(() => new ReportFontRegistry(families)).toThrow(ReportFontMissingError);
			expect(() => new ReportFontRegistry(families)).toThrow(/NotoSansTamil-Bold\.ttf/);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("refuses a file that is not the expected font, or not a font at all", () => {
		const swapped = REPORT_FONT_FAMILIES.map((family) => (family.key === "tamil" ? { ...family, familyName: "Noto Sans Bengali" } : family));
		expect(() => new ReportFontRegistry(swapped)).toThrow(ReportFontInvalidError);

		const directory = mkdtempSync(join(tmpdir(), "report-fonts-"));
		try {
			const families = copiedFamilies(directory);
			writeFileSync(families.find((family) => family.key === "han")?.files.regular.url ?? new URL("file:///missing"), "not a font");
			expect(() => new ReportFontRegistry(families)).toThrow(ReportFontInvalidError);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("needs a fallback family", () => {
		expect(() => new ReportFontRegistry(REPORT_FONT_FAMILIES.filter((family) => family.key !== FALLBACK_FONT_KEY))).toThrow(ReportFontInvalidError);
	});
});
