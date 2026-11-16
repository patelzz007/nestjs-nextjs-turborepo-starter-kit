import { RichTextEditor } from "@workspace/ui-native/components/rich-text-editor";
import * as React from "react";

const IGNORE = (): void => undefined;

export function RichTextEditorDo1Example(): React.JSX.Element {
	return <RichTextEditor initialContent={null} onChange={IGNORE} label="Broadcast" placeholder="Write the broadcast" compact />;
}
