"use client";

// The Popover examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Popover1Example } from "@/components/component-gallery/examples/popover/popover-1";
import { Popover2Example } from "@/components/component-gallery/examples/popover/popover-2";
import { Popover3Example } from "@/components/component-gallery/examples/popover/popover-3";
import { Popover4Example } from "@/components/component-gallery/examples/popover/popover-4";
import { Popover5Example } from "@/components/component-gallery/examples/popover/popover-5";
import { Popover6Example } from "@/components/component-gallery/examples/popover/popover-6";
import { Popover7Example } from "@/components/component-gallery/examples/popover/popover-7";
import { Popover8Example } from "@/components/component-gallery/examples/popover/popover-8";
import { Popover9Example } from "@/components/component-gallery/examples/popover/popover-9";
import { Popover10Example } from "@/components/component-gallery/examples/popover/popover-10";
import { Popover11Example } from "@/components/component-gallery/examples/popover/popover-11";

export const POPOVER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-popover-1", label: "Basic", component: Popover1Example },
	{ id: "c-popover-2", label: "Opening Sides", component: Popover2Example },
	{ id: "c-popover-3", label: "Inline Form", component: Popover3Example },
	{ id: "c-popover-4", label: "Alignment", component: Popover4Example },
	{ id: "c-popover-5", label: "In Dialog", component: Popover5Example },
	{ id: "c-popover-6", label: "Profile Card", component: Popover6Example },
	{ id: "c-popover-7", label: "Feature Pitch", component: Popover7Example },
	{ id: "c-popover-8", label: "Media Preview", component: Popover8Example },
	{ id: "c-popover-9", label: "Relative Time", component: Popover9Example },
	{ id: "c-popover-10", label: "Controls", component: Popover10Example },
	{ id: "c-popover-11", label: "Step Tour", component: Popover11Example },
];

export function PopoverExamples(): React.JSX.Element {
	return <ExampleGrid examples={POPOVER_EXAMPLES} />;
}
