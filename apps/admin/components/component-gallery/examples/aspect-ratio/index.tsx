"use client";

// The AspectRatio examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { AspectRatio1Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-1";
import { AspectRatio2Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-2";
import { AspectRatio3Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-3";
import { AspectRatio4Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-4";
import { AspectRatio5Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-5";
import { AspectRatio6Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-6";
import { AspectRatio7Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-7";
import { AspectRatio8Example } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-8";

export const ASPECT_RATIO_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-aspect-ratio-1", label: "Widescreen", component: AspectRatio1Example },
	{ id: "c-aspect-ratio-2", label: "Standard", component: AspectRatio2Example },
	{ id: "c-aspect-ratio-3", label: "Square", component: AspectRatio3Example },
	{ id: "c-aspect-ratio-4", label: "Ultrawide", component: AspectRatio4Example },
	{ id: "c-aspect-ratio-5", label: "Tall Portrait", component: AspectRatio5Example },
	{ id: "c-aspect-ratio-6", label: "Classic Photo", component: AspectRatio6Example },
	{ id: "c-aspect-ratio-7", label: "Social Portrait", component: AspectRatio7Example },
	{ id: "c-aspect-ratio-8", label: "Monitor", component: AspectRatio8Example },
];

export function AspectRatioExamples(): React.JSX.Element {
	return <ExampleGrid examples={ASPECT_RATIO_EXAMPLES} />;
}
