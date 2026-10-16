"use client";

// The Separator examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Separator1Example } from "@/components/component-gallery/examples/separator/separator-1";
import { Separator2Example } from "@/components/component-gallery/examples/separator/separator-2";
import { Separator3Example } from "@/components/component-gallery/examples/separator/separator-3";
import { Separator4Example } from "@/components/component-gallery/examples/separator/separator-4";
import { Separator5Example } from "@/components/component-gallery/examples/separator/separator-5";
import { Separator6Example } from "@/components/component-gallery/examples/separator/separator-6";

export const SEPARATOR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-separator-1", label: "Horizontal", component: Separator1Example },
	{ id: "c-separator-2", label: "Vertical", component: Separator2Example },
	{ id: "c-separator-3", label: "Grouped Menu Items", component: Separator3Example },
	{ id: "c-separator-4", label: "List Rows", component: Separator4Example },
	{ id: "c-separator-5", label: "Centered Label", component: Separator5Example },
	{ id: "c-separator-6", label: "Order Summary", component: Separator6Example },
];

export function SeparatorExamples(): React.JSX.Element {
	return <ExampleGrid examples={SEPARATOR_EXAMPLES} />;
}
