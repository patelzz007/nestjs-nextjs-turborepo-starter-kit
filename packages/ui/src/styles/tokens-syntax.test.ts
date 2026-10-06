// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const TOKENS_CSS = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

/** Comments removed the way a CSS parser does: each `/*` ends at the FIRST `*\/`, wherever it sits. */
const WITHOUT_COMMENTS = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//gu, "");

/** A custom-property declaration (`--name: value;`) on one line. */
const DECLARATION = /^\s*--[\w-]+\s*:\s*[^;{}]+;\s*$/u;

/** A rule's selector line (`:root {`, `.dark {`, `@theme inline {`) or its closing brace. */
const BLOCK_EDGE = /^\s*(?:[^{};]+\{|\})\s*$/u;

describe("tokens.css syntax", () => {
	it("leaves only selectors, braces and token declarations once comments are stripped — a stray `*/` inside a comment (e.g. a glob path) would leak text into a rule and break every app's build", () => {
		const strayLines = WITHOUT_COMMENTS.split("\n").filter((line) => line.trim() !== "" && !DECLARATION.test(line) && !BLOCK_EDGE.test(line));

		expect(strayLines).toEqual([]);
	});
});
