import type { RichTextDocument, RichTextTableCell } from "@workspace/shared";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import type * as React from "react";

function cell(type: RichTextTableCell["type"], text: string): RichTextTableCell {
	return { type, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

/** A wider body: a table that scrolls sideways, a code to copy, and the one button with its real domain. */
const OPENING_HOURS: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Opening hours" }] },
		{
			type: "table",
			content: [
				{
					type: "tableRow",
					content: ["Day", "Opens", "Closes", "Kitchen"].map((text) => cell("tableHeader", text)),
				},
				{
					type: "tableRow",
					content: ["Saturday", "8:00", "22:00", "21:30"].map((text) => cell("tableCell", text)),
				},
			],
		},
		{ type: "codeBlock", attrs: { language: "text" }, content: [{ type: "text", text: "HOURS-SAT-10" }] },
		{ type: "callToAction", attrs: { label: "Book a table", href: "https://book.acme.example/saturday" } },
	],
};

export function RichTextView2Example(): React.JSX.Element {
	return <RichTextView document={OPENING_HOURS} className="w-full" />;
}
