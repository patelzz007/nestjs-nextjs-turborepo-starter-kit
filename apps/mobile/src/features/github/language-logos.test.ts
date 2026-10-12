// The pinned simple-icons devDependency: only this test reads it — the app
// bundles the few paths it needs (language-logos.ts), never the package.
import * as simpleIcons from "simple-icons";
import type { SimpleIcon } from "simple-icons";

import { LANGUAGE_LOGOS, languageLogoOf, type LanguageLogo } from "./language-logos";

/** Every Simple Icons path, by slug. */
const SOURCE_PATHS: ReadonlyMap<string, string> = new Map(Object.values(simpleIcons).map((icon: SimpleIcon): [string, string] => [icon.slug, icon.path]));

describe("LANGUAGE_LOGOS", () => {
	it.each([...LANGUAGE_LOGOS])("draws %s exactly as Simple Icons does", (_language: string, logo: LanguageLogo) => {
		expect(logo.path).toBe(SOURCE_PATHS.get(logo.slug));
	});

	it("covers the languages most repositories report", () => {
		const common = ["TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C", "C++", "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Shell", "HTML", "CSS", "Dockerfile"];

		expect(common.filter((language: string): boolean => languageLogoOf(language) === null)).toEqual([]);
	});

	it("has no logo for a language Simple Icons does not draw", () => {
		expect(languageLogoOf("C#")).toBeNull();
		expect(languageLogoOf("Brainfuck")).toBeNull();
	});
});
