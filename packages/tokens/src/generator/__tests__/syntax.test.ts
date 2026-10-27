import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GeneratedFileNameSchema } from "../../schema";

/** Comments removed the way a CSS parser does: each `/*` ends at the FIRST `*\/`, wherever it sits. */
function withoutComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/** A custom-property declaration (`--name: value;`) on one line. */
const DECLARATION = /^\s*--[\w-]+\s*:\s*[^;{}]+;\s*$/u;

/** A rule's selector line (`:root {`, `.dark {`, `@theme inline {`, `@variant dark {`) or its closing brace. */
const BLOCK_EDGE = /^\s*(?:[^{};]+\{|\})\s*$/u;

/** A top-level custom variant (`@custom-variant nord (&:where(.nord, .nord *));`), the one block-less statement the generator writes. */
const CUSTOM_VARIANT = /^@custom-variant [a-z][\w-]* \([^;{}]+\);$/u;

/** The generated stylesheets; the favicon is SVG and has its own test (render-favicon.test.ts). */
const STYLESHEETS = GeneratedFileNameSchema.options.filter((fileName) => fileName.endsWith(".css"));

describe.each(STYLESHEETS)("generated/%s syntax", (fileName) => {
	it("leaves only selectors, braces, token declarations and custom variants once comments are stripped — a stray `*/` inside the header comment would leak text into a rule and break every app's build", () => {
		const css = readFileSync(new URL(`../../../generated/${fileName}`, import.meta.url), "utf8");
		const strayLines = withoutComments(css)
			.split("\n")
			.filter((line) => line.trim() !== "" && !DECLARATION.test(line) && !BLOCK_EDGE.test(line) && !CUSTOM_VARIANT.test(line));

		expect(strayLines).toStrictEqual([]);
	});

	it("balances its braces", () => {
		const css = withoutComments(readFileSync(new URL(`../../../generated/${fileName}`, import.meta.url), "utf8"));

		expect(css.split("{").length).toBe(css.split("}").length);
	});
});
