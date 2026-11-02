import { RichTextView } from "@workspace/ui/components/rich-text-view";
import type * as React from "react";

import { SAMPLE_RICH_TEXT } from "@/components/component-gallery/rich-text-sample";

/** A stored broadcast body as the inbox draws it. */
export function RichTextView1Example(): React.JSX.Element {
	return <RichTextView document={SAMPLE_RICH_TEXT} className="w-full" />;
}
