import { pageLink } from "@workspace/docs-content/document";
import { describe, expect, it } from "vitest";

import { inlineMarkdown, normalisePageId, notionPageIdOf, plainText } from "../notion-rich-text.ts";
import { PAGE_ID, text } from "./notion-fixtures.ts";

const COMPACT_ID = PAGE_ID.replaceAll("-", "");

describe("inlineMarkdown", () => {
	it.each([
		[text("Bold", { bold: true }), "**Bold**"],
		[text("Slanted", { italic: true }), "*Slanted*"],
		[text("Gone", { strikethrough: true }), "~~Gone~~"],
		[text("x = 1", { code: true }), "`x = 1`"],
		[text("Both", { bold: true, italic: true }), "***Both***"],
	])("draws %j", (item, expected) => {
		expect(inlineMarkdown([item]).markdown).toBe(expected);
	});

	it("keeps outer spaces outside the markers", () => {
		expect(inlineMarkdown([text("word ", { bold: true }), text("next")]).markdown).toBe("**word** next");
	});

	it("leaves spaces alone when there is nothing to style", () => {
		expect(inlineMarkdown([text("  ", { bold: true })]).markdown).toBe("  ");
	});

	it("escapes what the writer typed", () => {
		expect(inlineMarkdown([text("2 * 3 <b> [x] a_b")]).markdown).toBe("2 \\* 3 \\<b\\> \\[x\\] a\\_b");
	});

	it("keeps a line break", () => {
		expect(inlineMarkdown([text("One\nTwo")]).markdown).toBe("One\\\nTwo");
	});

	it("widens a code span around backticks", () => {
		expect(inlineMarkdown([text("a`b", { code: true })]).markdown).toBe("`` a`b ``");
	});

	it("draws an outside link", () => {
		expect(inlineMarkdown([text("Site", {}, "https://a.example")])).toMatchObject({ markdown: "[Site](https://a.example)", links: [] });
	});

	it("turns a link to a Notion page into a page link", () => {
		expect(inlineMarkdown([text("Setup", {}, `/${COMPACT_ID}`)])).toMatchObject({ markdown: `[Setup](${pageLink(PAGE_ID)})`, links: [PAGE_ID] });
	});

	it("turns a page mention into a page link", () => {
		const mention = { ...text("Setup"), type: "mention", mention: { type: "page", page: { id: PAGE_ID } } };

		expect(inlineMarkdown([mention])).toMatchObject({ markdown: `[Setup](${pageLink(PAGE_ID)})`, links: [PAGE_ID] });
	});

	it("turns a link preview into a link", () => {
		const mention = { ...text("Preview"), type: "mention", mention: { type: "link_preview", link_preview: { url: "https://a.example" } } };

		expect(inlineMarkdown([mention]).markdown).toBe("[Preview](https://a.example)");
	});

	it("keeps a date or user mention as its text", () => {
		expect(inlineMarkdown([{ ...text("Ada"), type: "mention", mention: { type: "user" } }]).markdown).toBe("Ada");
	});
});

describe("notionPageIdOf", () => {
	it.each([
		[`https://www.notion.so/My-Page-${COMPACT_ID}`, PAGE_ID],
		[`https://app.notion.com/p/${COMPACT_ID}?pvs=4`, PAGE_ID],
		[`/${COMPACT_ID}`, PAGE_ID],
		[`https://www.notion.so/${PAGE_ID}`, PAGE_ID],
	])("reads %s", (href, id) => {
		expect(notionPageIdOf(href)).toBe(id);
	});

	it.each(["https://a.example/11111111222233334444555555555555", "https://www.notion.so/pricing", "not a url"])("ignores %s", (href) => {
		expect(notionPageIdOf(href)).toBeNull();
	});
});

describe("normalisePageId", () => {
	it("writes every id the same way", () => {
		expect(normalisePageId(COMPACT_ID.toUpperCase())).toBe(PAGE_ID);
		expect(normalisePageId(PAGE_ID)).toBe(PAGE_ID);
	});
});

describe("plainText", () => {
	it("joins the words", () => {
		expect(plainText([text("a"), text("b", { bold: true })])).toBe("ab");
	});
});
