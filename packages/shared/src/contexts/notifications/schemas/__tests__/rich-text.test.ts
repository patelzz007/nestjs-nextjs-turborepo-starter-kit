import { describe, expect, it } from "vitest";

import {
	HttpsLinkSchema,
	RichTextDocumentResponseSchema,
	RichTextDocumentSchema,
	richTextLinks,
	richTextPlainLength,
	type RichTextBlock,
	type RichTextDocument,
	type RichTextParagraph,
	type RichTextTableRow,
} from "../rich-text";

function paragraph(text: string): RichTextParagraph {
	return { type: "paragraph", content: [{ type: "text", text }] };
}

function doc(...content: RichTextBlock[]): RichTextDocument {
	return { type: "doc", content };
}

describe("HttpsLinkSchema", () => {
	it("allows only absolute https links", () => {
		expect(HttpsLinkSchema.safeParse("https://example.com/a").success).toBe(true);
		expect(HttpsLinkSchema.safeParse("http://example.com").success).toBe(false);
		expect(HttpsLinkSchema.safeParse("javascript:alert(1)").success).toBe(false);
		expect(HttpsLinkSchema.safeParse("/relative").success).toBe(false);
	});
});

describe("RichTextDocumentSchema", () => {
	it("accepts every allowed node", () => {
		const body = doc(
			{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://a.example" } }] }] },
			{ type: "bulletList", content: [{ type: "listItem", content: [paragraph("one")] }] },
			{ type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "x" }] },
			{
				type: "table",
				content: [
					{ type: "tableRow", content: [{ type: "tableHeader", content: [paragraph("Day")] }] },
					{ type: "tableRow", content: [{ type: "tableCell", content: [paragraph("Sat")] }] },
				],
			},
			{ type: "callToAction", attrs: { label: "Go", href: "https://b.example" } },
			{ type: "horizontalRule" },
		);

		expect(RichTextDocumentSchema.safeParse(body).success).toBe(true);
	});

	it("rejects a node or mark it does not allow, rather than dropping it", () => {
		expect(RichTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [] }] }).success).toBe(false);
		expect(RichTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "iframe" }] }).success).toBe(false);
		expect(
			RichTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle" }] }] }] }).success,
		).toBe(false);
	});

	it("holds at most one button and one header row per table", () => {
		const button: RichTextBlock = { type: "callToAction", attrs: { label: "Go", href: "https://b.example" } };
		expect(RichTextDocumentSchema.safeParse(doc(button, button)).success).toBe(false);
		const header: RichTextTableRow = { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }] }] };
		expect(RichTextDocumentSchema.safeParse(doc({ type: "table", content: [header, header] })).success).toBe(false);
	});

	it("reads a stored document open: an unknown key is stripped, not rejected", () => {
		const parsed = RichTextDocumentResponseSchema.parse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }], extra: true }] });

		expect(parsed.content.at(0)).toEqual(paragraph("x"));
	});
});

describe("richTextLinks / richTextPlainLength", () => {
	it("finds every link, the button's included, and counts the text", () => {
		const body = doc(
			{ type: "paragraph", content: [{ type: "text", text: "abc", marks: [{ type: "link", attrs: { href: "https://a.example" } }] }] },
			{ type: "callToAction", attrs: { label: "Go", href: "https://b.example" } },
			{ type: "blockquote", content: [paragraph("de")] },
		);

		expect(richTextLinks(body)).toEqual(["https://a.example", "https://b.example"]);
		expect(richTextPlainLength(body)).toBe(5);
	});
});
