import { withImageSources, type RichTextDocument } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { renderRichTextHtml } from "../render-rich-text";

const SHOWN = "0190f0e0-0000-7000-8000-000000000001";
const GONE = "0190f0e0-0000-7000-8000-000000000002";
const DOCUMENT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "image", attrs: { fileId: SHOWN, alt: "Our new shop" } },
		{ type: "image", attrs: { fileId: GONE, alt: "Removed" } },
	],
};

describe("renderRichTextHtml pictures (enhancement 5.4)", () => {
	it("shows a picture at its server-filled address (escaped), and leaves one without an address out", () => {
		const html = renderRichTextHtml(withImageSources(DOCUMENT, new Map([[SHOWN, 'https://cdn.example.com/top.webp?a=1&b="2"']])));
		expect(html).toContain('<img src="https://cdn.example.com/top.webp?a=1&amp;b=&quot;2&quot;" alt="Our new shop"');
		expect(html.match(/<img /gu)).toHaveLength(1);
		expect(html).not.toContain("Removed");
	});
});
