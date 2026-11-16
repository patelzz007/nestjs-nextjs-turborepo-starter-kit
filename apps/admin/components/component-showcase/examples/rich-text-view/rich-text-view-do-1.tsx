import * as React from "react";
import type { RichTextDocument } from "@workspace/shared";
import { RichTextView } from "@workspace/ui/components/rich-text-view";

const DOC: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Opening hours" }] },
		{
			type: "bulletList",
			content: [
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Weekdays 8:00 to 18:00" }] }] },
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Saturday 9:00 to 14:00" }] }] },
			],
		},
	],
};

export function RichTextViewDo1Example(): React.JSX.Element {
	return <RichTextView document={DOC} className="w-full max-w-md" />;
}
