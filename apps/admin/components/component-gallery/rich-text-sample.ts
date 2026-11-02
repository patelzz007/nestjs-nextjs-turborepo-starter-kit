import type { RichTextDocument } from "@workspace/shared";

/** A broadcast body using every allowed node: the gallery's editor and view demos start from it. */
export const SAMPLE_RICH_TEXT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Weekend specials" }] },
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Half price lattes", marks: [{ type: "bold" }] },
				{ type: "text", text: " all Saturday. See the " },
				{ type: "text", text: "full menu", marks: [{ type: "link", attrs: { href: "https://acme.example/menu" } }] },
				{ type: "text", text: "." },
			],
		},
		{
			type: "bulletList",
			content: [
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Latte" }] }] },
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Flat white" }] }] },
			],
		},
		{
			type: "table",
			content: [
				{
					type: "tableRow",
					content: [
						{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Day" }] }] },
						{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Opens" }] }] },
					],
				},
				{
					type: "tableRow",
					content: [
						{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Saturday" }] }] },
						{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "8:00" }] }] },
					],
				},
			],
		},
		{ type: "codeBlock", attrs: { language: "text" }, content: [{ type: "text", text: "WEEKEND50" }] },
		{ type: "callToAction", attrs: { label: "Order now", href: "https://order.acme.example/start" } },
	],
};
