import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CODE_BLOCK_TYPE_CLASS, docsCodeBlockElement } from "./element";
import type { DocsCodeBlockProps } from "./props";

const PROPS: DocsCodeBlockProps = {
	lines: [{ tokens: [{ content: "const a = 1;" }], number: 1, text: "const a = 1;" }],
	language: "ts",
	title: "a.ts",
	showLineNumbers: false,
	foldable: false,
	maxLines: null,
};

/** The class list of the CodeBlock root (`data-slot="code-block"`). */
function rootClasses(html: string): readonly string[] {
	const match = /<div[^>]*data-slot="code-block"[^>]*class="([^"]*)"|<div[^>]*class="([^"]*)"[^>]*data-slot="code-block"/.exec(html);
	return (match?.[1] ?? match?.[2] ?? "").split(" ");
}

describe("docsCodeBlockElement", () => {
	it("sizes code from the docs type scale instead of the component's default", () => {
		const classes = rootClasses(renderToStaticMarkup(docsCodeBlockElement(PROPS)));
		expect(classes).toContain(CODE_BLOCK_TYPE_CLASS);
		// tailwind-merge drops the component's own size token, so only one font-size token remains.
		expect(classes.filter((name) => name.startsWith("[--code-block-font-size:"))).toEqual(["[--code-block-font-size:var(--type-code-block-size)]"]);
	});
});
