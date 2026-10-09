import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GeneratedFileNameSchema } from "../schema";

/** Comments removed the way a CSS parser does: each `/*` ends at the FIRST `*\/`, wherever it sits. */
function withoutComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/** A custom-property declaration (`--name: value;`) on one line. */
const DECLARATION = /^\s*--[\w-]+\s*:\s*[^;{}]+;\s*$/u;

/** A rule's selector line (`:root {`, `.dark {`, `@theme inline {`, `@variant dark {`) or its closing brace. */
const BLOCK_EDGE = /^\s*(?:[^{};]+\{|\})\s*$/u;

describe.each(GeneratedFileNameSchema.options)("generated/%s syntax", (fileName) => {
	it("leaves only selectors, braces and token declarations once comments are stripped — a stray `*/` inside the header comment would leak text into a rule and break every app's build", () => {
		const css = readFileSync(new URL(`../../generated/${fileName}`, import.meta.url), "utf8");
		const strayLines = withoutComments(css)
			.split("\n")
			.filter((line) => line.trim() !== "" && !DECLARATION.test(line) && !BLOCK_EDGE.test(line));

		expect(strayLines).toStrictEqual([]);
	});

	it("balances its braces", () => {
		const css = withoutComments(readFileSync(new URL(`../../generated/${fileName}`, import.meta.url), "utf8"));

		expect(css.split("{").length).toBe(css.split("}").length);
	});
});
