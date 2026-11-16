import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
import * as React from "react";

const IGNORE = (): void => undefined;

export function RichTextEditorDont1Example(): React.JSX.Element {
	return <RichTextEditor initialContent={null} onChange={IGNORE} label="Text" compact />;
}
