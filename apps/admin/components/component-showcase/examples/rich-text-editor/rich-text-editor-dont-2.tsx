import * as React from "react";
import { RichTextEditor, useRichTextEditor, type RichTextEditorContent } from "@workspace/ui/components/rich-text-editor";
import { richTextToEditorContent } from "@workspace/ui/lib/rich-text/editor-extensions";

import { SAMPLE_RICH_TEXT } from "@/components/component-showcase/examples/rich-text-sample";

export function RichTextEditorDont2Example(): React.JSX.Element {
	const [initialContent] = React.useState((): RichTextEditorContent => richTextToEditorContent(SAMPLE_RICH_TEXT));
	const [, setContent] = React.useState<RichTextEditorContent>(initialContent);
	const editor = useRichTextEditor({ initialContent, onChange: setContent, placeholder: "Write your message", label: "Note" });
	return (
		<RichTextEditor editor={editor} className="w-full max-w-lg">
			<RichTextEditor.Toolbar>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Undo />
					<RichTextEditor.Redo />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.H2 />
					<RichTextEditor.H3 />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Bold />
					<RichTextEditor.Italic />
					<RichTextEditor.Underline />
					<RichTextEditor.Strikethrough />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.BulletList />
					<RichTextEditor.OrderedList />
					<RichTextEditor.Blockquote />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Link />
					<RichTextEditor.Unlink />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
		</RichTextEditor>
	);
}
