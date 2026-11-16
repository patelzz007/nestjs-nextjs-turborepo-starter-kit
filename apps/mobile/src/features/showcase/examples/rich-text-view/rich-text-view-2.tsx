import type { RichTextDocument, RichTextTableCell } from "@workspace/shared";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { Linking } from "react-native";

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
				{ type: "tableRow", content: ["Day", "Opens", "Closes", "Kitchen"].map((text: string): RichTextTableCell => cell("tableHeader", text)) },
				{ type: "tableRow", content: ["Saturday", "8:00", "22:00", "21:30"].map((text: string): RichTextTableCell => cell("tableCell", text)) },
			],
		},
		{ type: "codeBlock", attrs: { language: "text" }, content: [{ type: "text", text: "HOURS-SAT-10" }] },
		{ type: "callToAction", attrs: { label: "Book a table", href: "https://book.acme.example/saturday" } },
	],
};

function openLink(href: string): void {
	// A link the phone cannot open stays where it is; there is nothing to undo.
	Linking.openURL(href).catch((): void => undefined);
}

function copyCode(code: string): void {
	// A refused copy changes nothing on screen.
	Clipboard.setStringAsync(code).catch((): void => undefined);
}

// A table that scrolls sideways, a code block that copies, and the button showing the domain it opens.
export function RichTextView2Example(): React.JSX.Element {
	return <RichTextView document={OPENING_HOURS} onOpenLink={openLink} onCopyCode={copyCode} className="w-full" />;
}
