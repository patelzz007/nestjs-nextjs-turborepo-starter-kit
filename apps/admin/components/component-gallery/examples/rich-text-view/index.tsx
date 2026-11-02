"use client";

// The RichTextView examples on the /components page.

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { RichTextView1Example } from "@/components/component-gallery/examples/rich-text-view/rich-text-view-1";
import { RichTextView2Example } from "@/components/component-gallery/examples/rich-text-view/rich-text-view-2";

export const RICH_TEXT_VIEW_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-rich-text-view-1", label: "Broadcast Body", component: RichTextView1Example },
	{ id: "c-rich-text-view-2", label: "Table, Code And Button", component: RichTextView2Example },
];

export function RichTextViewExamples(): React.JSX.Element {
	return <ExampleGrid examples={RICH_TEXT_VIEW_EXAMPLES} />;
}
