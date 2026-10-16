"use client";

// The Bubble examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Bubble1Example } from "@/components/component-gallery/examples/bubble/bubble-1";
import { Bubble2Example } from "@/components/component-gallery/examples/bubble/bubble-2";
import { Bubble3Example } from "@/components/component-gallery/examples/bubble/bubble-3";
import { Bubble4Example } from "@/components/component-gallery/examples/bubble/bubble-4";
import { Bubble5Example } from "@/components/component-gallery/examples/bubble/bubble-5";
import { Bubble6Example } from "@/components/component-gallery/examples/bubble/bubble-6";
import { Bubble7Example } from "@/components/component-gallery/examples/bubble/bubble-7";

export const BUBBLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-bubble-1", label: "Sender Alignment", component: Bubble1Example },
	{ id: "c-bubble-2", label: "All Variants", component: Bubble2Example },
	{ id: "c-bubble-3", label: "Grouped Messages", component: Bubble3Example },
	{ id: "c-bubble-4", label: "Reactions", component: Bubble4Example },
	{ id: "c-bubble-5", label: "Show More", component: Bubble5Example },
	{ id: "c-bubble-6", label: "Quick Replies", component: Bubble6Example },
	{ id: "c-bubble-7", label: "Formatted Answer", component: Bubble7Example },
];

export function BubbleExamples(): React.JSX.Element {
	return <ExampleGrid examples={BUBBLE_EXAMPLES} />;
}
