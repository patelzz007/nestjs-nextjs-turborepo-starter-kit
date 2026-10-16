"use client";

// The Toggle examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Toggle1Example } from "@/components/component-gallery/examples/toggle/toggle-1";
import { Toggle2Example } from "@/components/component-gallery/examples/toggle/toggle-2";
import { Toggle3Example } from "@/components/component-gallery/examples/toggle/toggle-3";
import { Toggle4Example } from "@/components/component-gallery/examples/toggle/toggle-4";
import { Toggle5Example } from "@/components/component-gallery/examples/toggle/toggle-5";
import { Toggle6Example } from "@/components/component-gallery/examples/toggle/toggle-6";
import { Toggle7Example } from "@/components/component-gallery/examples/toggle/toggle-7";
import { Toggle8Example } from "@/components/component-gallery/examples/toggle/toggle-8";
import { Toggle9Example } from "@/components/component-gallery/examples/toggle/toggle-9";
import { Toggle10Example } from "@/components/component-gallery/examples/toggle/toggle-10";
import { Toggle11Example } from "@/components/component-gallery/examples/toggle/toggle-11";
import { Toggle12Example } from "@/components/component-gallery/examples/toggle/toggle-12";
import { Toggle13Example } from "@/components/component-gallery/examples/toggle/toggle-13";
import { Toggle14Example } from "@/components/component-gallery/examples/toggle/toggle-14";

export const TOGGLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-toggle-1", label: "Basic", component: Toggle1Example },
	{ id: "c-toggle-2", label: "Outline", component: Toggle2Example },
	{ id: "c-toggle-3", label: "Text Sizes", component: Toggle3Example },
	{ id: "c-toggle-4", label: "Button Comparison", component: Toggle4Example },
	{ id: "c-toggle-5", label: "Disabled Text", component: Toggle5Example },
	{ id: "c-toggle-6", label: "Icon & Label", component: Toggle6Example },
	{ id: "c-toggle-7", label: "Count Badge", component: Toggle7Example },
	{ id: "c-toggle-8", label: "Icon Sizes", component: Toggle8Example },
	{ id: "c-toggle-9", label: "Icon Swap", component: Toggle9Example },
	{ id: "c-toggle-10", label: "Label Swap", component: Toggle10Example },
	{ id: "c-toggle-11", label: "Reactions", component: Toggle11Example },
	{ id: "c-toggle-12", label: "Tooltip", component: Toggle12Example },
	{ id: "c-toggle-13", label: "Disabled Icons", component: Toggle13Example },
	{ id: "c-toggle-14", label: "Mute Button", component: Toggle14Example },
];

export function ToggleExamples(): React.JSX.Element {
	return <ExampleGrid examples={TOGGLE_EXAMPLES} />;
}
