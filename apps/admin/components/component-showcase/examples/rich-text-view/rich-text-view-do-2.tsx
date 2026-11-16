import * as React from "react";
import type { RichTextDocument } from "@workspace/shared";
import { RichTextView } from "@workspace/ui/components/rich-text-view";

const DOC: RichTextDocument = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "See " },
				{ type: "text", text: "the full menu", marks: [{ type: "link", attrs: { href: "https://acme.example/menu" } }] },
				{ type: "text", text: " for prices." },
			],
		},
	],
};

export function RichTextViewDo2Example(): React.JSX.Element {
	return <RichTextView document={DOC} className="w-full max-w-md" />;
}
