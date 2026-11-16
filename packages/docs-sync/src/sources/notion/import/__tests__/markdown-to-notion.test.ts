import { describe, expect, it } from "vitest";

import { withNotionStyle } from "../../notion-diagram-style.ts";
import { markdownToNotion, type NotionBlockInput } from "../markdown-to-notion.ts";

const CONTEXT = { linkTarget: (url: string): string | null => (url.startsWith("https://") ? url : null) };

function blocksOf(markdown: string): readonly NotionBlockInput[] {
	return markdownToNotion(markdown, CONTEXT).blocks;
}

function typesOf(markdown: string): readonly string[] {
	return blocksOf(markdown).map((block) => block.type);
}

describe("markdownToNotion", () => {
	it("drops a leading title: the page has its own", () => {
		expect(typesOf("# Title\n\nWords.")).toEqual(["paragraph"]);
	});

	it("maps headings, capping at Notion's deepest", () => {
		expect(typesOf("Intro\n\n## A\n\n### B\n\n##### C")).toEqual(["paragraph", "heading_2", "heading_3", "heading_4"]);
	});

	it("carries inline styles and links", () => {
		const [block] = blocksOf("**bold** `code` [site](https://a.example)");

		expect(block?.content.rich_text).toEqual([
			{ type: "text", text: { content: "bold" }, annotations: { bold: true } },
			{ type: "text", text: { content: " " } },
			{ type: "text", text: { content: "code" }, annotations: { code: true } },
			{ type: "text", text: { content: " " } },
			{ type: "text", text: { content: "site", link: { url: "https://a.example" } } },
		]);
	});

	it("keeps the words of a link with no Notion address, and reports it", () => {
		const { blocks, reviews } = markdownToNotion("[here](#anchor)", CONTEXT);

		expect(blocks.at(0)?.content.rich_text).toEqual([{ type: "text", text: { content: "here" } }]);
		expect(reviews).toEqual(["The link #anchor has no address in Notion; its text was kept."]);
	});

	it("splits text longer than Notion's limit", () => {
		const [block] = blocksOf("a".repeat(2500));

		expect(block?.content.rich_text).toHaveLength(2);
	});

	it("nests lists at any depth", () => {
		const [item] = blocksOf("- one\n  - two\n    - three");

		expect(item?.type).toBe("bulleted_list_item");
		expect(item?.children.at(0)?.children.at(0)?.type).toBe("bulleted_list_item");
	});

	it("maps numbered lists and tasks", () => {
		expect(typesOf("1. a\n2. b")).toEqual(["numbered_list_item", "numbered_list_item"]);
		expect(blocksOf("- [x] done").at(0)).toMatchObject({ type: "to_do", content: { checked: true } });
	});

	it("turns a marked quote into a callout whose icon the sync reads back", () => {
		const [block] = blocksOf("> [!WARNING] Careful");

		expect(block).toMatchObject({ type: "callout", content: { icon: { type: "emoji", emoji: "⚠️" } } });
		expect(block?.content.rich_text).toEqual([{ type: "text", text: { content: "Careful" } }]);
	});

	it("keeps a plain quote a quote", () => {
		expect(typesOf("> Said")).toEqual(["quote"]);
	});

	it("maps code languages and splits long code", () => {
		const [block] = blocksOf(`\`\`\`ts\n${"x".repeat(2500)}\n\`\`\``);

		expect(block).toMatchObject({ type: "code", content: { language: "typescript" } });
		expect(block?.content.rich_text).toHaveLength(2);
	});

	it("colours a flowchart for Notion, and nothing else", () => {
		const [chart, code] = blocksOf("```mermaid\nflowchart TD\n  A --> B\n```\n\n```ts\nflowchart TD\n```");
		expect(chart).toMatchObject({ content: { language: "mermaid", rich_text: [{ text: { content: withNotionStyle("flowchart TD\n  A --> B") } }] } });
		expect(code).toMatchObject({ content: { rich_text: [{ text: { content: "flowchart TD" } }] } });
	});

	it("keeps a fence named as Notion names the language", () => {
		expect(blocksOf("```typescript\nconst a = 1;\n```").at(0)).toMatchObject({ type: "code", content: { language: "typescript" } });
		expect(blocksOf("```groovy\nx\n```").at(0)).toMatchObject({ content: { language: "groovy" } });
	});

	it("keeps a bare email address bare, with nothing to review: the site links it again", () => {
		const { blocks, reviews } = markdownToNotion("Write to ops@example.com today.", CONTEXT);

		expect(blocks.at(0)?.content.rich_text).toEqual([
			{ type: "text", text: { content: "Write to " } },
			{ type: "text", text: { content: "ops@example.com" } },
			{ type: "text", text: { content: " today." } },
		]);
		expect(reviews).toEqual([]);
	});

	it("still reports a written mailto link whose words differ from the address", () => {
		expect(markdownToNotion("[the team](mailto:ops@example.com)", CONTEXT).reviews).toEqual(["The link mailto:ops@example.com has no address in Notion; its text was kept."]);
	});

	it("reports a fence Notion has no language for", () => {
		const { blocks, reviews } = markdownToNotion("```carousel\n![a](b.png)\n```", CONTEXT);

		expect(blocks.at(0)).toMatchObject({ content: { language: "plain text" } });
		expect(reviews.at(0)).toContain('"carousel"');
	});

	it("builds a table with its rows", () => {
		const [table] = blocksOf("| A | B |\n| --- | --- |\n| 1 | 2 |");

		expect(table).toMatchObject({ type: "table", content: { table_width: 2, has_column_header: true } });
		expect(table?.children).toHaveLength(2);
	});

	it("gives a short row empty cells, so every row is as wide as the header (Notion refuses one that is not)", () => {
		const [table] = blocksOf("| A | B | C |\n| --- | --- | --- |\n| 1 |");

		expect(table?.content.table_width).toBe(3);
		expect(table?.children.at(1)?.content.cells).toEqual([[{ type: "text", text: { content: "1" } }], [], []]);
	});

	it("leaves out cells past the header's width, as the site does, and lists them for review", () => {
		const { blocks, reviews } = markdownToNotion("| A | B |\n| --- | --- |\n| 1 | 2 | 3 |", CONTEXT);

		expect(blocks.at(0)?.content.table_width).toBe(2);
		expect(blocks.at(0)?.children.at(1)?.content.cells).toHaveLength(2);
		expect(reviews).toEqual(["A table row has 3 cells under a 2-column header; the extra cells are not imported."]);
	});

	it("keeps a web image, and marks a repository image for upload", () => {
		expect(blocksOf("![a](https://a.example/b.png)").at(0)).toMatchObject({ type: "image", content: { type: "external", external: { url: "https://a.example/b.png" } } });
		expect(blocksOf("![a](images/b.png)").at(0)?.localImage).toBe("images/b.png");
	});

	it("lifts an image out of a sentence", () => {
		expect(typesOf("Words ![a](images/b.png) more")).toEqual(["paragraph", "image"]);
	});

	it("draws a divider", () => {
		expect(typesOf("a\n\n---\n\nb")).toEqual(["paragraph", "divider", "paragraph"]);
	});

	it("keeps raw HTML as text, and reports it", () => {
		const { blocks, reviews } = markdownToNotion("<details>\n<summary>x</summary>\n</details>", CONTEXT);

		expect(blocks).toHaveLength(1);
		expect(reviews.at(0)).toContain("Raw HTML");
	});
});
