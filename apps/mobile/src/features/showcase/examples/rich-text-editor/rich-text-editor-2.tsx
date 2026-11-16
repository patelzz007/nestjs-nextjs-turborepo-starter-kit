import { RichTextDocumentSchema, type RichTextDocument } from "@workspace/shared";
import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
import { RichTextView } from "@workspace/ui-native/components/rich-text-view";
import * as React from "react";
import { Text, View } from "react-native";

const NO_LINKS = (): void => undefined;

// A short toolbar beside a live preview of what customers see, drawn from the validated document.
export function RichTextEditor2Example(): React.JSX.Element {
	const [document, setDocument] = React.useState<RichTextDocument | null>(null);
	const change = React.useCallback((next: RichTextDocument): void => {
		const parsed = RichTextDocumentSchema.safeParse(next);
		setDocument(parsed.success && parsed.data.content.length > 0 ? parsed.data : null);
	}, []);
	return (
		<View className="w-full gap-3">
			<RichTextEditor initialContent={null} onChange={change} label="Short message" placeholder="Type something, then format it" compact />
			<View className="rounded-lg border border-dashed border-border p-3">
				{document === null ? (
					<Text className="text-label font-sans text-muted-foreground">The preview appears as you type.</Text>
				) : (
					<RichTextView document={document} onOpenLink={NO_LINKS} />
				)}
			</View>
		</View>
	);
}
