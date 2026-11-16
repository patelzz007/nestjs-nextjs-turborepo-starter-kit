import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
import * as React from "react";

const IGNORE = (): void => undefined;

export function RichTextEditorDo2Example(): React.JSX.Element {
	return <RichTextEditor initialContent={null} onChange={IGNORE} label="Short message" compact />;
}
