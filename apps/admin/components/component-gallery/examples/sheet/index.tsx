"use client";

// The Sheet examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Sheet1Example } from "@/components/component-gallery/examples/sheet/sheet-1";
import { Sheet2Example } from "@/components/component-gallery/examples/sheet/sheet-2";
import { Sheet3Example } from "@/components/component-gallery/examples/sheet/sheet-3";
import { Sheet4Example } from "@/components/component-gallery/examples/sheet/sheet-4";

export const SHEET_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-sheet-1", label: "Profile Editor", component: Sheet1Example },
	{ id: "c-sheet-2", label: "No Close Button", component: Sheet2Example },
	{ id: "c-sheet-3", label: "Any Side", component: Sheet3Example },
	{ id: "c-sheet-4", label: "Scrollable Content", component: Sheet4Example },
];

export function SheetExamples(): React.JSX.Element {
	return <ExampleGrid examples={SHEET_EXAMPLES} />;
}
