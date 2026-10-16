"use client";

// The Marker examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Marker1Example } from "@/components/component-gallery/examples/marker/marker-1";
import { Marker2Example } from "@/components/component-gallery/examples/marker/marker-2";
import { Marker3Example } from "@/components/component-gallery/examples/marker/marker-3";
import { Marker4Example } from "@/components/component-gallery/examples/marker/marker-4";
import { Marker5Example } from "@/components/component-gallery/examples/marker/marker-5";
import { Marker6Example } from "@/components/component-gallery/examples/marker/marker-6";

export const MARKER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-marker-1", label: "Basic Variants", component: Marker1Example },
	{ id: "c-marker-2", label: "Tool Call Log", component: Marker2Example },
	{ id: "c-marker-3", label: "Run Status", component: Marker3Example },
	{ id: "c-marker-4", label: "Phase Separators", component: Marker4Example },
	{ id: "c-marker-5", label: "Changed Files", component: Marker5Example },
	{ id: "c-marker-6", label: "Links & Action", component: Marker6Example },
];

export function MarkerExamples(): React.JSX.Element {
	return <ExampleGrid examples={MARKER_EXAMPLES} />;
}
