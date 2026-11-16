import type { RichTextDocument } from "@workspace/shared";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as React from "react";

const IGNORE = (): void => undefined;

const BODY: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "WHAT CHANGED", marks: [{ type: "bold" }] }] },
		{ type: "paragraph", content: [{ type: "text", text: "- Faster checkout" }] },
		{ type: "paragraph", content: [{ type: "text", text: "- New receipts" }] },
	],
};

export function RichTextViewDont1Example(): React.JSX.Element {
	return <RichTextView document={BODY} onOpenLink={IGNORE} />;
}
