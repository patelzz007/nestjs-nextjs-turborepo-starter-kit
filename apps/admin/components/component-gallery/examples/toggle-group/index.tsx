"use client";

// The ToggleGroup examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { ToggleGroup1Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-1";
import { ToggleGroup2Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-2";
import { ToggleGroup3Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-3";
import { ToggleGroup4Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-4";
import { ToggleGroup5Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-5";
import { ToggleGroup6Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-6";
import { ToggleGroup7Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-7";
import { ToggleGroup8Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-8";
import { ToggleGroup9Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-9";
import { ToggleGroup10Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-10";
import { ToggleGroup11Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-11";
import { ToggleGroup12Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-12";
import { ToggleGroup13Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-13";
import { ToggleGroup14Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-14";
import { ToggleGroup15Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-15";
import { ToggleGroup16Example } from "@/components/component-gallery/examples/toggle-group/toggle-group-16";

export const TOGGLE_GROUP_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-toggle-group-1", label: "Basic", component: ToggleGroup1Example },
	{ id: "c-toggle-group-2", label: "Outline", component: ToggleGroup2Example },
	{ id: "c-toggle-group-3", label: "Sizes", component: ToggleGroup3Example },
	{ id: "c-toggle-group-4", label: "Custom Spacing", component: ToggleGroup4Example },
	{ id: "c-toggle-group-5", label: "Filter Control", component: ToggleGroup5Example },
	{ id: "c-toggle-group-6", label: "Vertical", component: ToggleGroup6Example },
	{ id: "c-toggle-group-7", label: "Text Alignment", component: ToggleGroup7Example },
	{ id: "c-toggle-group-8", label: "View Mode", component: ToggleGroup8Example },
	{ id: "c-toggle-group-9", label: "Vertical Settings", component: ToggleGroup9Example },
	{ id: "c-toggle-group-10", label: "Color Theme", component: ToggleGroup10Example },
	{ id: "c-toggle-group-11", label: "Font Size", component: ToggleGroup11Example },
	{ id: "c-toggle-group-12", label: "Time Range", component: ToggleGroup12Example },
	{ id: "c-toggle-group-13", label: "Notification Channels", component: ToggleGroup13Example },
	{ id: "c-toggle-group-14", label: "Layout Columns", component: ToggleGroup14Example },
	{ id: "c-toggle-group-15", label: "Sort Direction", component: ToggleGroup15Example },
	{ id: "c-toggle-group-16", label: "Pricing Tier", component: ToggleGroup16Example },
];

export function ToggleGroupExamples(): React.JSX.Element {
	return <ExampleGrid examples={TOGGLE_GROUP_EXAMPLES} />;
}
