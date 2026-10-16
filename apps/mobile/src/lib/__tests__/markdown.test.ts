import { htmlImagesOf, openableHref, parseMarkdown, plainTextOf } from "../markdown";

describe("parseMarkdown", () => {
	it("is empty for an empty or blank body", () => {
		expect(parseMarkdown("")).toEqual([]);
		expect(parseMarkdown("  \n\n ")).toEqual([]);
	});

	it("reads paragraphs with emphasis, code and links", () => {
		expect(parseMarkdown("Fixes **the bug** in `app.ts`, see [docs](https://example.com/docs) _now_ ~~later~~.")).toEqual([
			{
				kind: "paragraph",
				children: [
					{ kind: "text", text: "Fixes " },
					{ kind: "strong", children: [{ kind: "text", text: "the bug" }] },
					{ kind: "text", text: " in " },
					{ kind: "code", text: "app.ts" },
					{ kind: "text", text: ", see " },
					{ kind: "link", href: "https://example.com/docs", children: [{ kind: "text", text: "docs" }] },
					{ kind: "text", text: " " },
					{ kind: "emphasis", children: [{ kind: "text", text: "now" }] },
					{ kind: "text", text: " " },
					{ kind: "strike", children: [{ kind: "text", text: "later" }] },
					{ kind: "text", text: "." },
				],
			},
		]);
	});

	it("reads headings, fenced code with its language, quotes and rules", () => {
		const blocks = parseMarkdown("## Summary\n\n```ts\nconst a = 1;\n```\n\n> quoted\n\n---");

		expect(blocks).toEqual([
			{ kind: "heading", level: 2, children: [{ kind: "text", text: "Summary" }] },
			{ kind: "code", text: "const a = 1;", language: "ts" },
			{ kind: "quote", blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "quoted" }] }] },
			{ kind: "rule" },
		]);
	});

	it("reads ordered lists from their start number, and task lists with their checkboxes", () => {
		const [ordered, tasks] = parseMarkdown("3. third\n4. fourth\n\n- [x] done\n- [ ] todo");

		expect(ordered).toMatchObject({ kind: "list", ordered: true, start: 3, items: [{ checked: null }, { checked: null }] });
		expect(tasks).toMatchObject({
			kind: "list",
			ordered: false,
			items: [
				{ checked: true, blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "done" }] }] },
				{ checked: false, blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "todo" }] }] },
			],
		});
	});

	it("reads a table's header and rows", () => {
		const [table] = parseMarkdown("| a | b |\n| - | - |\n| 1 | **2** |");

		expect(table).toEqual({
			kind: "table",
			header: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }]],
			rows: [[[{ kind: "text", text: "1" }], [{ kind: "strong", children: [{ kind: "text", text: "2" }] }]]],
		});
	});

	it("draws a picture as a block of its own, with the text around it kept in order", () => {
		expect(parseMarkdown("Before ![shot](https://example.com/a.png) after")).toEqual([
			{ kind: "paragraph", children: [{ kind: "text", text: "Before " }] },
			{ kind: "image", href: "https://example.com/a.png", alt: "shot", width: null, height: null, link: null },
			{ kind: "paragraph", children: [{ kind: "text", text: " after" }] },
		]);
	});

	it("reads GitHub's <img> for a pasted screenshot, with its size", () => {
		const source = '<img width="735" height="490" alt="dd2c" src="https://github.com/user-attachments/assets/cb5fe4d3-85fb-4d1e-807a-1771925051be" />\r\n';

		expect(parseMarkdown(source)).toEqual([
			{ kind: "image", href: "https://github.com/user-attachments/assets/cb5fe4d3-85fb-4d1e-807a-1771925051be", alt: "dd2c", width: 735, height: 490, link: null },
		]);
	});

	it("reads an <img> written inside a sentence", () => {
		expect(parseMarkdown("See <img src=\"https://example.com/a.png?x=1&amp;y=2\" alt='it'> here")).toEqual([
			{ kind: "paragraph", children: [{ kind: "text", text: "See " }] },
			{ kind: "image", href: "https://example.com/a.png?x=1&y=2", alt: "it", width: null, height: null, link: null },
			{ kind: "paragraph", children: [{ kind: "text", text: " here" }] },
		]);
	});

	it("drops the layout tags around pictures, and keeps a linked picture's link", () => {
		expect(parseMarkdown('<p align="center">\n  <img src="https://example.com/logo.png">\n</p>')).toEqual([
			{ kind: "image", href: "https://example.com/logo.png", alt: "", width: null, height: null, link: null },
		]);
		expect(parseMarkdown("[![build](https://example.com/badge.svg)](https://example.com/ci)")).toEqual([
			{ kind: "image", href: "https://example.com/badge.svg", alt: "build", width: null, height: null, link: "https://example.com/ci" },
		]);
	});

	it("reads <br> as a line break", () => {
		expect(parseMarkdown("one<br>two")).toEqual([{ kind: "paragraph", children: [{ kind: "text", text: "one" }, { kind: "break" }, { kind: "text", text: "two" }] }]);
	});

	it("keeps HTML as the text it was written as", () => {
		expect(plainTextOf(parseMarkdown("Hello <b>there</b>").flatMap((block) => (block.kind === "paragraph" ? block.children : [])))).toBe("Hello <b>there</b>");
	});
});

describe("htmlImagesOf", () => {
	it("lists the pictures of HTML that holds nothing else", () => {
		expect(htmlImagesOf('<a href="https://x.test"><img src="https://x.test/a.png" width="10" height="nope"></a>')).toEqual([
			{ href: "https://x.test/a.png", alt: "", width: 10, height: null },
		]);
		expect(htmlImagesOf('<img alt="no address">')).toEqual([]);
	});

	it("is null for HTML that holds anything but pictures", () => {
		expect(htmlImagesOf('<details><summary>More</summary><img src="https://x.test/a.png"></details>')).toBeNull();
		expect(htmlImagesOf("<b>bold</b>")).toBeNull();
	});
});

describe("openableHref", () => {
	it.each(["https://github.com/octo-org", "http://example.com/a?b=1"])("opens %s", (href: string) => {
		expect(openableHref(href)).toBe(href);
	});

	it.each(["javascript:alert(1)", "file:///etc/passwd", "myapp://open", "/relative/path", "not a url"])("refuses %s", (href: string) => {
		expect(openableHref(href)).toBeNull();
	});
});
