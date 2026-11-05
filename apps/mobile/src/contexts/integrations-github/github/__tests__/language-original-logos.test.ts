// Each entry's SVG is checked byte for byte against the installed devicon package by
// packages/tooling/__tests__/language-original-logos.test.mjs (it reads files, which Hermes-bound
// code may not); this suite covers the lookup.
import { LANGUAGE_ORIGINAL_LOGOS, languageOriginalLogoOf } from "../language-original-logos";

describe("LANGUAGE_ORIGINAL_LOGOS", () => {
	it("covers the languages most repositories report", () => {
		const common = [
			"TypeScript",
			"JavaScript",
			"Python",
			"Java",
			"Go",
			"Rust",
			"C",
			"C++",
			"Ruby",
			"PHP",
			"Swift",
			"Kotlin",
			"Dart",
			"Shell",
			"HTML",
			"CSS",
			"Dockerfile",
			"PLpgSQL",
		];

		expect(common.filter((language: string): boolean => languageOriginalLogoOf(language) === null)).toEqual([]);
	});

	it("has no original logo for a language devicon does not draw", () => {
		expect(languageOriginalLogoOf("Batchfile")).toBeNull();
		expect(languageOriginalLogoOf("Brainfuck")).toBeNull();
	});

	it("keeps every entry a whole SVG document", () => {
		for (const logo of LANGUAGE_ORIGINAL_LOGOS.values()) {
			expect(logo.xml.startsWith("<svg")).toBe(true);
			expect(logo.xml.endsWith("</svg>")).toBe(true);
		}
	});
});
