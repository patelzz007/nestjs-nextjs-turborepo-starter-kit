// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** Comments removed the way a CSS parser does: each `/*` ends at the FIRST `*\/`, wherever it sits. */
function withoutComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/** A custom-property declaration (`--name: value;`) on one line. */
const DECLARATION = /^\s*--[\w-]+\s*:\s*[^;{}]+;\s*$/u;

/** A rule's selector line (`:root {`, `.dark {`, `@theme inline {`) or its closing brace. */
const BLOCK_EDGE = /^\s*(?:[^{};]+\{|\})\s*$/u;

const STYLESHEETS: readonly string[] = ["palette.css", "tokens.css"];

describe.each(STYLESHEETS)("%s syntax", (file) => {
	it("leaves only selectors, braces and token declarations once comments are stripped — a stray `*/` inside a comment (e.g. a glob path) would leak text into a rule and break every app's build", () => {
		const css = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
		const strayLines = withoutComments(css)
			.split("\n")
			.filter((line) => line.trim() !== "" && !DECLARATION.test(line) && !BLOCK_EDGE.test(line));

		expect(strayLines).toEqual([]);
	});
});
