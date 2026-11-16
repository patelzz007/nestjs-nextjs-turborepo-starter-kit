import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as React from "react";
import { Linking } from "react-native";

import { SAMPLE_RICH_TEXT } from "../rich-text-sample";

function openLink(href: string): void {
	// A link the phone cannot open stays where it is; there is nothing to undo.
	Linking.openURL(href).catch((): void => undefined);
}

// A stored broadcast body as the inbox draws it: a heading, marks, a link, a list, a table, a code and the one button.
export function RichTextView1Example(): React.JSX.Element {
	return <RichTextView document={SAMPLE_RICH_TEXT} onOpenLink={openLink} className="w-full" />;
}
