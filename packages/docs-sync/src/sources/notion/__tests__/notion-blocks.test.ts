import { assetLink, PAGE_TITLE_TOKEN, pageLink } from "@workspace/docs-content/document";
import { describe, expect, it } from "vitest";

import { convertBlocks } from "../notion-blocks.ts";
import { withNotionStyle } from "../notion-diagram-style.ts";
import { block, paragraph, PAGE_ID, text, tree } from "./notion-fixtures.ts";

function markdownOf(...trees: Parameters<typeof convertBlocks>[0]): string {
	return convertBlocks(trees).markdown;
}

describe("convertBlocks: text blocks", () => {
	it("separates paragraphs with a blank line and skips empty ones", () => {
		const empty = tree(block("paragraph", { paragraph: { rich_text: [] } }));

		expect(markdownOf(paragraph("One"), empty, paragraph("Two"))).toBe("One\n\nTwo");
	});

	it.each([
		["heading_1", "# Title"],
		["heading_2", "## Title"],
		["heading_3", "### Title"],
		["heading_4", "#### Title"],
	])("converts %s", (type, expected) => {
		expect(markdownOf(tree(block(type, { [type]: { rich_text: [text("Title")] } })))).toBe(expected);
	});

	it("holds back a toggle heading", () => {
		const { issues } = convertBlocks([tree(block("heading_2", { heading_2: { rich_text: [text("T")], is_toggleable: true } }))]);

		expect(issues).toEqual([expect.objectContaining({ blockType: "heading_2", reason: "This heading is a toggle." })]);
	});

	it("keeps a list together, numbers it, and restarts after other content", () => {
		const item = (content: string): ReturnType<typeof tree> => tree(block("numbered_list_item", { numbered_list_item: { rich_text: [text(content)] } }));

		expect(markdownOf(item("One"), item("Two"), paragraph("Break"), item("Again"))).toBe("1. One\n2. Two\n\nBreak\n\n1. Again");
	});

	it("nests a list under its parent", () => {
		const child = tree(block("bulleted_list_item", { bulleted_list_item: { rich_text: [text("Child")] } }));
		const parent = tree(block("bulleted_list_item", { bulleted_list_item: { rich_text: [text("Parent")] }, has_children: true }), [child]);

		expect(markdownOf(parent)).toBe("- Parent\n\n  - Child");
	});

	it("converts to-do items, checked and not", () => {
		const todo = (content: string, checked: boolean): ReturnType<typeof tree> => tree(block("to_do", { to_do: { rich_text: [text(content)], checked } }));

		expect(markdownOf(todo("Done", true), todo("Open", false))).toBe("- [x] Done\n- [ ] Open");
	});

	it("converts a quote and its children", () => {
		expect(markdownOf(tree(block("quote", { quote: { rich_text: [text("Said")] } }), [paragraph("More")]))).toBe("> Said\n>\n> More");
	});

	it("draws a divider", () => {
		expect(markdownOf(tree(block("divider")))).toBe("---");
	});
});

describe("convertBlocks: callouts", () => {
	it.each([
		["ℹ️", "INFO"],
		["⚠️", "WARNING"],
		["⛔", "DANGER"],
		["✅", "TIP"],
		["🍰", "NOTE"],
	])("picks the kind from the icon %s", (emoji, kind) => {
		const callout = tree(block("callout", { callout: { rich_text: [text("Careful")], icon: { type: "emoji", emoji } } }));

		expect(markdownOf(callout)).toBe(`> [!${kind}]\n> Careful`);
	});
});

describe("convertBlocks: toggles", () => {
	it("becomes a details element holding its children", () => {
		expect(markdownOf(tree(block("toggle", { toggle: { rich_text: [text("More")] } }), [paragraph("Hidden")]))).toBe(
			"<details>\n<summary>More</summary>\n\nHidden\n\n</details>",
		);
	});
});

describe("convertBlocks: code", () => {
	it("fences code with its language and caption", () => {
		const code = tree(block("code", { code: { rich_text: [text("const a = 1;")], language: "TypeScript", caption: [text("a.ts")] } }));

		expect(markdownOf(code)).toBe('```typescript title="a.ts"\nconst a = 1;\n```');
	});

	it("keeps Mermaid as a diagram fence and maps Notion's language names", () => {
		const fence = (language: string): string => markdownOf(tree(block("code", { code: { rich_text: [text("x")], language } })));

		expect(fence("mermaid")).toBe("```mermaid\nx\n```");
		expect(fence("plain text")).toBe("```text\nx\n```");
	});

	it("takes Notion's colours out of a flowchart, and leaves other code as written", () => {
		const styled = withNotionStyle("flowchart TD\n  A --> B");
		expect(markdownOf(tree(block("code", { code: { rich_text: [text(styled)], language: "mermaid" } })))).toBe("```mermaid\nflowchart TD\n  A --> B\n```");
		expect(markdownOf(tree(block("code", { code: { rich_text: [text(styled)], language: "plain text" } })))).toBe(`\`\`\`text\n${styled}\n\`\`\``);
	});

	it("uses a longer fence around code that holds backticks", () => {
		expect(markdownOf(tree(block("code", { code: { rich_text: [text("````")], language: "markdown" } })))).toBe("`````markdown\n````\n`````");
	});
});

describe("convertBlocks: tables", () => {
	it("makes the first row the header and pads short rows", () => {
		const row = (...cells: string[]): ReturnType<typeof tree> => tree(block("table_row", { table_row: { cells: cells.map((cell) => [text(cell)]) } }));
		const table = tree(block("table", { table: { has_column_header: true, table_width: 2 } }), [row("Name", "Value"), row("A")]);

		expect(markdownOf(table)).toBe("| Name | Value |\n| --- | --- |\n| A |  |");
	});

	it("escapes a pipe in a cell", () => {
		const table = tree(block("table", { table: { has_column_header: true, table_width: 1 } }), [tree(block("table_row", { table_row: { cells: [[text("a|b")]] } }))]);

		expect(markdownOf(table)).toContain("a\\|b");
	});
});

describe("convertBlocks: images and links", () => {
	it("hands a hosted image to the engine as an asset", () => {
		const url = "https://prod-files-secure.s3.us-west-2.amazonaws.com/a.png";
		const body = convertBlocks([tree(block("image", { image: { type: "file", file: { url }, caption: [text("Alt [text]")] } }, "img"))]);

		expect(body.markdown).toBe(`![Alt text](${assetLink("img")})`);
		expect(body.assets).toEqual([{ assetKey: "img", url }]);
	});

	it("keeps an https image link as it is", () => {
		expect(markdownOf(tree(block("image", { image: { type: "external", external: { url: "https://a.example/b.png" } } })))).toBe("![](https://a.example/b.png)");
	});

	it("refuses an image link that is not https", () => {
		const body = convertBlocks([tree(block("image", { image: { type: "external", external: { url: "http://a.example/b.png" } } }))]);

		expect(body.issues).toHaveLength(1);
	});

	it("turns a bookmark into a link", () => {
		expect(markdownOf(tree(block("bookmark", { bookmark: { url: "https://a.example", caption: [text("A site")] } })))).toBe("[A site](https://a.example)");
		expect(markdownOf(tree(block("bookmark", { bookmark: { url: "https://a.example" } })))).toBe("[https://a.example](https://a.example)");
	});

	it("resolves a link to another page by id, with the title left to the engine", () => {
		const body = convertBlocks([tree(block("link_to_page", { link_to_page: { type: "page_id", page_id: PAGE_ID } }))]);

		expect(body.markdown).toBe(`[${PAGE_TITLE_TOKEN}](${pageLink(PAGE_ID)})`);
		expect(body.links).toEqual([PAGE_ID]);
	});
});

describe("convertBlocks: what is not supported", () => {
	it.each(["column_list", "synced_block", "child_page", "child_database", "embed", "video", "pdf", "file", "equation", "some_future_block"])(
		"holds back a page with a %s block, naming the block",
		(type) => {
			const { issues } = convertBlocks([tree(block(type, {}, "block-9"))]);

			expect(issues).toEqual([expect.objectContaining({ blockId: "block-9", blockType: type })]);
			expect(issues.at(0)?.fix.length).toBeGreaterThan(0);
		},
	);

	it("holds back text holding an equation", () => {
		const equation = { ...text("x"), type: "equation" };

		expect(convertBlocks([tree(block("paragraph", { paragraph: { rich_text: [equation] } }))]).issues).toEqual([expect.objectContaining({ blockType: "equation" })]);
	});

	it("collects every problem on a page at once", () => {
		expect(convertBlocks([tree(block("embed")), paragraph("Fine"), tree(block("video"))]).issues).toHaveLength(2);
	});
});
