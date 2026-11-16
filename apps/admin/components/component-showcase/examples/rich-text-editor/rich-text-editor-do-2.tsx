import * as React from "react";
import { RichTextEditor, useRichTextEditor, type RichTextEditorContent } from "@workspace/ui/components/rich-text-editor";
import { richTextToEditorContent } from "@workspace/ui/lib/rich-text/editor-extensions";

import { SAMPLE_RICH_TEXT } from "@/components/component-showcase/examples/rich-text-sample";

export function RichTextEditorDo2Example(): React.JSX.Element {
	const [initialContent] = React.useState((): RichTextEditorContent => richTextToEditorContent(SAMPLE_RICH_TEXT));
	const [, setContent] = React.useState<RichTextEditorContent>(initialContent);
	const editor = useRichTextEditor({ initialContent, onChange: setContent, placeholder: "Write your message", label: "Note" });
	return (
		<RichTextEditor editor={editor} className="w-full max-w-lg">
			<RichTextEditor.Toolbar>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Bold />
					<RichTextEditor.Italic />
					<RichTextEditor.Link />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
		</RichTextEditor>
	);
}
