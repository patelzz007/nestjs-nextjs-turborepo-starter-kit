"use client";

import { RichTextEditor, useRichTextEditor, type RichTextEditorContent } from "@workspace/ui/components/rich-text-editor";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { RichTextDocumentSchema, type RichTextDocument } from "@workspace/shared";
import * as React from "react";

/** A short toolbar with a live preview: what customers see, drawn from the validated JSON. */
export function RichTextEditor2Example(): React.JSX.Element {
	const [document, setDocument] = React.useState<RichTextDocument | null>(null);
	const handleChange = React.useCallback((content: RichTextEditorContent): void => {
		const parsed = RichTextDocumentSchema.safeParse(content);
		setDocument(parsed.success ? parsed.data : null);
	}, []);
	const editor = useRichTextEditor({ initialContent: null, onChange: handleChange, placeholder: "Type something, then format it", label: "Short message" });
	return (
		<div className="grid w-full gap-4 md:grid-cols-2">
			<RichTextEditor editor={editor}>
				<RichTextEditor.Toolbar>
					<RichTextEditor.ControlsGroup>
						<RichTextEditor.Bold />
						<RichTextEditor.Italic />
						<RichTextEditor.Link />
						<RichTextEditor.BulletList />
					</RichTextEditor.ControlsGroup>
				</RichTextEditor.Toolbar>
				<RichTextEditor.Content />
			</RichTextEditor>
			<div className="rounded-lg border border-dashed border-border p-3">
				{document === null ? <p className="text-sm text-muted-foreground">The preview appears as you type.</p> : <RichTextView document={document} />}
			</div>
		</div>
	);
}
