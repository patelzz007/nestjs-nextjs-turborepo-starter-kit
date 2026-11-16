import type { RichTextDocument } from "@workspace/shared";
import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_RICH_TEXT } from "../rich-text-sample";

// The full toolbar: undo, marks, links, headings, lists, quotes, code, a divider and the one button, over a broadcast.
export function RichTextEditor1Example(): React.JSX.Element {
	const [document, setDocument] = React.useState<RichTextDocument>(SAMPLE_RICH_TEXT);
	return (
		<View className="w-full gap-2">
			<RichTextEditor initialContent={SAMPLE_RICH_TEXT} onChange={setDocument} label="Broadcast" placeholder="Write the broadcast" />
			<Text className="text-caption font-sans text-muted-foreground">{`${String(document.content.length)} blocks`}</Text>
		</View>
	);
}
