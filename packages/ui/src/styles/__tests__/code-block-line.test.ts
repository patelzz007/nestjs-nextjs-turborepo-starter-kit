// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LINE_CLASS } from "../../components/code-block-styles";

const COMPONENTS_CSS = readFileSync(join(import.meta.dirname, "..", "components.css"), "utf8");

/** The utilities `@apply`-ed into the row class, in order. */
function rowUtilities(): readonly string[] {
	const utilities = new RegExp(`@utility ${LINE_CLASS} \\{\\s*@apply(?<utilities>[^;]*);`).exec(COMPONENTS_CSS)?.groups?.utilities;
	return utilities === undefined ? [] : utilities.trim().split(/\s+/);
}

describe("the code block row class", () => {
	it("is a Tailwind utility, so it keeps the utilities layer the per-row classes had", () => {
		expect(COMPONENTS_CSS).toContain(`@utility ${LINE_CLASS} {`);
	});

	it("keeps the gutter counter, the per-line gutter label, the diff glyphs, focus mode and streaming motion", () => {
		expect(rowUtilities()).toEqual(
			expect.arrayContaining([
				"[[data-code-line-numbers]_&]:before:content-[counter(cb-line)]",
				"[[data-code-line-numbers]_&[data-gutter]]:before:content-[attr(data-gutter)]",
				"data-[diff=add]:after:content-['+']",
				"data-[diff=remove]:after:content-['-']",
				"group-hover/code-block:data-[blurred]:opacity-100",
				"[[data-streaming]_&]:animate-in",
				"motion-reduce:animate-none",
			]),
		);
	});
});
