"use client";

// The ScrollArea examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { ScrollArea1Example } from "@/components/component-gallery/examples/scroll-area/scroll-area-1";
import { ScrollArea2Example } from "@/components/component-gallery/examples/scroll-area/scroll-area-2";
import { ScrollArea3Example } from "@/components/component-gallery/examples/scroll-area/scroll-area-3";
import { ScrollArea4Example } from "@/components/component-gallery/examples/scroll-area/scroll-area-4";
import { ScrollArea5Example } from "@/components/component-gallery/examples/scroll-area/scroll-area-5";

export const SCROLL_AREA_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-scroll-area-1", label: "Basic", component: ScrollArea1Example },
	{ id: "c-scroll-area-2", label: "Horizontal", component: ScrollArea2Example },
	{ id: "c-scroll-area-3", label: "Both Scrollbars", component: ScrollArea3Example },
	{ id: "c-scroll-area-4", label: "Fade Edges", component: ScrollArea4Example },
	{ id: "c-scroll-area-5", label: "Scrollbar Gutter", component: ScrollArea5Example },
];

export function ScrollAreaExamples(): React.JSX.Element {
	return <ExampleGrid examples={SCROLL_AREA_EXAMPLES} />;
}
