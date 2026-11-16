import type { RichTextDocument } from "@workspace/shared";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as React from "react";

const IGNORE = (): void => undefined;

const BODY: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "What changed" }] },
		{
			type: "bulletList",
			content: [
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Faster checkout" }] }] },
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "New receipts" }] }] },
			],
		},
	],
};

export function RichTextViewDo1Example(): React.JSX.Element {
	return <RichTextView document={BODY} onOpenLink={IGNORE} />;
}
