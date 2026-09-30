import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";

import { parseProps } from "../code-block/props";
import { codeBlockProps, codeSource, fenceLanguage, fenceMeta, highlightingFailed, rehypeCodeBlock } from "./code-block";

/** A `<code>` element as remark-rehype emits it (fence meta travels on `data.meta`). */
function codeElement(source: string, className: readonly string[], meta?: string): Element {
	return {
		type: "element",
		tagName: "code",
		properties: { className: [...className] },
		children: [{ type: "text", value: source }],
		...(meta === undefined ? {} : { data: { meta } }),
	};
}

function fence(source: string, language: string, meta?: string): Element {
	return { type: "element", tagName: "pre", properties: {}, children: [codeElement(source, language.length === 0 ? [] : [`language-${language}`], meta)] };
}

/** The props JSON embedded in an island's markup. */
function islandProps(html: string): ReturnType<typeof parseProps> {
	const match = /<script type="application\/json" data-code-block-props>([\s\S]*?)<\/script>/.exec(html);
	return parseProps(match?.[1] ?? "");
}

describe("fence helpers", () => {
	it("reads the fence tag and the source without the trailing newline", () => {
		const code = codeElement("a\nb\n", ["language-ts"]);
		expect(fenceLanguage(code)).toBe("ts");
		expect(codeSource(code)).toBe("a\nb");
		expect(fenceLanguage(codeElement("x", []))).toBe("");
	});

	it("reads fence meta, defaulting to empty", () => {
		expect(fenceMeta(codeElement("x", [], 'title="a.ts"'))).toBe('title="a.ts"');
		expect(fenceMeta(codeElement("x", []))).toBe("");
	});
});

describe("codeBlockProps", () => {
	it("highlights with both theme colours and applies fence meta", async () => {
		const props = await codeBlockProps("const a = 1;\nconst b = 2;", "ts", 'title="a.ts" {2}');
		expect(props.title).toBe("a.ts");
		expect(props.language).toBe("ts");
		expect(props.showLineNumbers).toBe(true);
		expect(props.lines).toHaveLength(2);
		expect(props.lines[1]?.state?.highlighted).toBe(true);
		const keyword = props.lines[0]?.tokens.find((token) => token.content === "const");
		expect(keyword?.color).toBeDefined();
		expect(keyword?.colorDark).toBeDefined();
		expect(keyword?.color).not.toBe(keyword?.colorDark);
	});

	it("keeps unknown languages as plain text", async () => {
		const props = await codeBlockProps("just text", "not-a-language", "");
		expect(props.lines).toEqual([{ tokens: [{ content: "just text" }], number: 1, text: "just text" }]);
		expect(props.showLineNumbers).toBe(false);
	});
});

describe("highlightingFailed", () => {
	const plain = [{ tokens: [{ content: "const a = 1;" }], number: 1, text: "const a = 1;" }];
	const coloured = [{ tokens: [{ content: "const", color: "#D73A49", colorDark: "#F97583" }], number: 1, text: "const" }];

	it("flags a supported language that came back uncoloured", () => {
		expect(highlightingFailed("ts", "const a = 1;", plain)).toBe(true);
	});

	it("accepts coloured output, unsupported languages and empty blocks", () => {
		expect(highlightingFailed("ts", "const", coloured)).toBe(false);
		expect(highlightingFailed("not-a-language", "x", plain)).toBe(false);
		expect(highlightingFailed("ts", "   ", [])).toBe(false);
	});
});

describe("rehypeCodeBlock", () => {
	it("replaces fences with hydratable CodeBlock islands and leaves other nodes alone", async () => {
		const paragraph: Element = { type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: "hi" }] };
		const tree: Root = { type: "root", children: [paragraph, fence("pnpm dev\n", "bash", 'title="Terminal"')] };
		await rehypeCodeBlock()(tree);

		expect(tree.children[0]).toBe(paragraph);
		const block = tree.children[1];
		const html = block?.type === "raw" ? block.value : "";
		expect(html).toContain('<div class="code-block-island"><div data-code-block-root>');
		expect(html).toContain('data-slot="code-block"');
		expect(html).toContain("Terminal");
		expect(html).toContain("pnpm");
		expect(islandProps(html)).toMatchObject({ language: "bash", title: "Terminal", showLineNumbers: false });
	});

	it("handles several fences in order", async () => {
		const tree: Root = { type: "root", children: [fence("one\n", ""), fence("two\n", "")] };
		await rehypeCodeBlock()(tree);
		const texts = tree.children.map((child) => (child.type === "raw" ? islandProps(child.value).lines[0]?.text : null));
		expect(texts).toEqual(["one", "two"]);
	});
});
