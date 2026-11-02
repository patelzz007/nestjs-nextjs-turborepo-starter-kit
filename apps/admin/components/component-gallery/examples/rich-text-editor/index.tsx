"use client";

// The RichTextEditor examples on the /components page.

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { RichTextEditor1Example } from "@/components/component-gallery/examples/rich-text-editor/rich-text-editor-1";
import { RichTextEditor2Example } from "@/components/component-gallery/examples/rich-text-editor/rich-text-editor-2";

export const RICH_TEXT_EDITOR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-rich-text-editor-1", label: "Broadcast Toolbar", component: RichTextEditor1Example },
	{ id: "c-rich-text-editor-2", label: "With Live Preview", component: RichTextEditor2Example },
];

export function RichTextEditorExamples(): React.JSX.Element {
	return <ExampleGrid examples={RICH_TEXT_EDITOR_EXAMPLES} />;
}
