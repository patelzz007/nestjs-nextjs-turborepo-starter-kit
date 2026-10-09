import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { Theme, TokenSource } from "../schema";
import { GeneratedFileNameSchema } from "../schema";
import { DARK_THEME, THEMES } from "../semantic";
import { TOKEN_SOURCE } from "../source";
import { oklch } from "../value";
import { generateTokenStylesheets } from "./generate";
import { renderMobileStylesheet } from "./render-mobile";
import { renderWebStylesheet } from "./render-web";

describe("generateTokenStylesheets", () => {
	it("produces every generated file, once each", () => {
		expect(generateTokenStylesheets(TOKEN_SOURCE).map(({ fileName }) => fileName)).toStrictEqual(GeneratedFileNameSchema.options);
	});

	it("is deterministic: the same source gives byte-identical output", () => {
		expect(generateTokenStylesheets(structuredClone(TOKEN_SOURCE))).toStrictEqual(generateTokenStylesheets(TOKEN_SOURCE));
	});

	it("does not depend on the order the data modules list their keys in", () => {
		const { "edge-highlight": edgeHighlight, card, ...otherRoles } = DARK_THEME;
		const reorderedDark: Theme = { "edge-highlight": edgeHighlight, card, ...otherRoles };
		const reordered: TokenSource = { ...TOKEN_SOURCE, themes: { dark: reorderedDark, light: THEMES.light } };

		expect(Object.keys(reorderedDark).slice(0, 2)).toStrictEqual(["edge-highlight", "card"]);
		expect(Object.keys(reordered.themes).at(0)).toBe("dark");
		expect(renderWebStylesheet(reordered)).toBe(renderWebStylesheet(TOKEN_SOURCE));
		expect(renderMobileStylesheet(reordered)).toBe(renderMobileStylesheet(TOKEN_SOURCE));
		expect(generateTokenStylesheets(reordered)).toStrictEqual(generateTokenStylesheets(TOKEN_SOURCE));
	});

	it("fails on a value the schema does not support", () => {
		const invalid = { ...TOKEN_SOURCE, themes: { ...THEMES, dark: { ...DARK_THEME, card: oklch(1.5, 0, 0) } } };

		expect(() => generateTokenStylesheets(invalid)).toThrow(ZodError);
	});
});
