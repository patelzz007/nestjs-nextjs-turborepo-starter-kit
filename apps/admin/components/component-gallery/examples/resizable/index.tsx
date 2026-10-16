"use client";

// The Resizable examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Resizable1Example } from "@/components/component-gallery/examples/resizable/resizable-1";
import { Resizable2Example } from "@/components/component-gallery/examples/resizable/resizable-2";
import { Resizable3Example } from "@/components/component-gallery/examples/resizable/resizable-3";
import { Resizable4Example } from "@/components/component-gallery/examples/resizable/resizable-4";
import { Resizable5Example } from "@/components/component-gallery/examples/resizable/resizable-5";
import { Resizable6Example } from "@/components/component-gallery/examples/resizable/resizable-6";
import { Resizable7Example } from "@/components/component-gallery/examples/resizable/resizable-7";
import { Resizable8Example } from "@/components/component-gallery/examples/resizable/resizable-8";
import { Resizable9Example } from "@/components/component-gallery/examples/resizable/resizable-9";
import { Resizable10Example } from "@/components/component-gallery/examples/resizable/resizable-10";

export const RESIZABLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-resizable-1", label: "Horizontal Layout", component: Resizable1Example },
	{ id: "c-resizable-2", label: "Vertical Layout", component: Resizable2Example },
	{ id: "c-resizable-3", label: "Mixed Directions", component: Resizable3Example },
	{ id: "c-resizable-4", label: "Nested Grips", component: Resizable4Example },
	{ id: "c-resizable-5", label: "Animated Pill", component: Resizable5Example },
	{ id: "c-resizable-6", label: "Spring Pill", component: Resizable6Example },
	{ id: "c-resizable-7", label: "Capsule Expansion", component: Resizable7Example },
	{ id: "c-resizable-8", label: "Nested Pills", component: Resizable8Example },
	{ id: "c-resizable-9", label: "Three Panels", component: Resizable9Example },
	{ id: "c-resizable-10", label: "Size Tracking", component: Resizable10Example },
];

export function ResizableExamples(): React.JSX.Element {
	return <ExampleGrid examples={RESIZABLE_EXAMPLES} />;
}
