import type { RichTextDocument } from "@workspace/shared";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as React from "react";

const IGNORE = (): void => undefined;

const BODY: RichTextDocument = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "For the menu, tap " },
				{ type: "text", text: "here", marks: [{ type: "link", attrs: { href: "https://acme.example/menu" } }] },
				{ type: "text", text: "." },
			],
		},
	],
};

export function RichTextViewDont2Example(): React.JSX.Element {
	return <RichTextView document={BODY} onOpenLink={IGNORE} />;
}
