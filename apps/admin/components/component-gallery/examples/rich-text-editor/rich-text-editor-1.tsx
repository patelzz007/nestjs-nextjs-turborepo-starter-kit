"use client";

import { RichTextEditor, useRichTextEditor, type RichTextEditorContent } from "@workspace/ui/components/rich-text-editor";
import { RICH_TEXT_MAX_TEXT_LENGTH } from "@workspace/shared";
import { richTextToEditorContent } from "@workspace/ui/lib/rich-text/editor-extensions";
import * as React from "react";

import { SAMPLE_RICH_TEXT } from "@/components/component-gallery/rich-text-sample";

/** Every control a broadcast may use, starting from a sample body. */
export function RichTextEditor1Example(): React.JSX.Element {
	const [initialContent] = React.useState((): RichTextEditorContent => richTextToEditorContent(SAMPLE_RICH_TEXT));
	const [, setContent] = React.useState<RichTextEditorContent>(initialContent);
	const editor = useRichTextEditor({ initialContent, onChange: setContent, placeholder: "Write your message", label: "Message" });
	return (
		<RichTextEditor editor={editor} className="w-full">
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
					<RichTextEditor.Code />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.BulletList />
					<RichTextEditor.OrderedList />
					<RichTextEditor.Blockquote />
					<RichTextEditor.CodeBlock />
					<RichTextEditor.Hr />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Table />
					<RichTextEditor.AddRow />
					<RichTextEditor.AddColumn />
					<RichTextEditor.DeleteTable />
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Link />
					<RichTextEditor.Unlink />
					<RichTextEditor.CallToAction />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
			<RichTextEditor.Footer limit={RICH_TEXT_MAX_TEXT_LENGTH} />
		</RichTextEditor>
	);
}
