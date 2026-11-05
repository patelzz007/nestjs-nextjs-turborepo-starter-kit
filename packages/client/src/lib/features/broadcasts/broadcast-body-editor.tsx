"use client";

import { RICH_TEXT_MAX_TEXT_LENGTH, type RichTextDocument } from "@workspace/shared";
import { RichTextEditor, useRichTextEditor, type RichTextEditorContent, type UploadedPicture } from "@workspace/ui/components/rich-text-editor";
import { richTextToEditorContent } from "@workspace/ui/lib/rich-text/editor-extensions";
import * as React from "react";

/** How the sender uploads the body's picture: through its file category, accepting these types. */
export interface BroadcastPictureUpload {
	readonly upload: (file: File) => Promise<UploadedPicture>;
	readonly accept: string;
}

export interface BroadcastBodyEditorProps {
	/** The saved body when editing a draft; null for a new broadcast. */
	readonly initialBody: RichTextDocument | null;
	readonly onChange: (content: RichTextEditorContent) => void;
	readonly placeholder: string;
	readonly disabled: boolean;
	readonly invalid: boolean;
	/** The picture control's upload; undefined hides the control. */
	readonly picture?: BroadcastPictureUpload | undefined;
}

/**
 * The broadcast message editor and its toolbar. Its own module so the composer can load it lazily
 * (enhancement 8.3): the editor engine is most of the composer pages' JavaScript, and nothing else on the
 * page needs it.
 */
export default function BroadcastBodyEditor({ initialBody, onChange, placeholder, disabled, invalid, picture }: BroadcastBodyEditorProps): React.JSX.Element {
	const [initialContent] = React.useState((): RichTextEditorContent | null => (initialBody === null ? null : richTextToEditorContent(initialBody)));
	const editor = useRichTextEditor({ initialContent, onChange, placeholder, label: "Message" });
	return (
		<RichTextEditor editor={editor} disabled={disabled} invalid={invalid}>
			<RichTextEditor.Toolbar>
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
					{picture === undefined ? null : <RichTextEditor.Picture upload={picture.upload} accept={picture.accept} />}
				</RichTextEditor.ControlsGroup>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Undo />
					<RichTextEditor.Redo />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
			<RichTextEditor.Footer limit={RICH_TEXT_MAX_TEXT_LENGTH} />
		</RichTextEditor>
	);
}
