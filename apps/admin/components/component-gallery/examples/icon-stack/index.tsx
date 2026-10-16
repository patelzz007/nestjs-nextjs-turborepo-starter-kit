"use client";

// The IconStack examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { IconStack1Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-1";
import { IconStack2Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-2";
import { IconStack3Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-3";
import { IconStack4Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-4";
import { IconStack5Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-5";
import { IconStack6Example } from "@/components/component-gallery/examples/icon-stack/icon-stack-6";

export const ICON_STACK_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-icon-stack-1", label: "Isometric", component: IconStack1Example },
	{ id: "c-icon-stack-2", label: "Sizes", component: IconStack2Example },
	{ id: "c-icon-stack-3", label: "Colors", component: IconStack3Example },
	{ id: "c-icon-stack-4", label: "Badge Overlay", component: IconStack4Example },
	{ id: "c-icon-stack-5", label: "Empty State", component: IconStack5Example },
	{ id: "c-icon-stack-6", label: "Item Media", component: IconStack6Example },
];

export function IconStackExamples(): React.JSX.Element {
	return <ExampleGrid examples={ICON_STACK_EXAMPLES} />;
}
