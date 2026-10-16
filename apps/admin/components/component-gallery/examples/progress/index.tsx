"use client";

// The Progress examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Progress1Example } from "@/components/component-gallery/examples/progress/progress-1";
import { Progress2Example } from "@/components/component-gallery/examples/progress/progress-2";
import { Progress3Example } from "@/components/component-gallery/examples/progress/progress-3";
import { Progress4Example } from "@/components/component-gallery/examples/progress/progress-4";
import { Progress5Example } from "@/components/component-gallery/examples/progress/progress-5";
import { Progress6Example } from "@/components/component-gallery/examples/progress/progress-6";
import { Progress7Example } from "@/components/component-gallery/examples/progress/progress-7";
import { Progress8Example } from "@/components/component-gallery/examples/progress/progress-8";

export const PROGRESS_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-progress-1", label: "Basic", component: Progress1Example },
	{ id: "c-progress-2", label: "Small", component: Progress2Example },
	{ id: "c-progress-3", label: "Large", component: Progress3Example },
	{ id: "c-progress-4", label: "Status Messages", component: Progress4Example },
	{ id: "c-progress-5", label: "File Uploads", component: Progress5Example },
	{ id: "c-progress-6", label: "With Slider", component: Progress6Example },
	{ id: "c-progress-7", label: "Multi-Step", component: Progress7Example },
	{ id: "c-progress-8", label: "Custom Colors", component: Progress8Example },
];

export function ProgressExamples(): React.JSX.Element {
	return <ExampleGrid examples={PROGRESS_EXAMPLES} />;
}
