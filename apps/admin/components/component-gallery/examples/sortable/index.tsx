"use client";

// The Sortable examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Sortable1Example } from "@/components/component-gallery/examples/sortable/sortable-1";
import { Sortable2Example } from "@/components/component-gallery/examples/sortable/sortable-2";
import { Sortable3Example } from "@/components/component-gallery/examples/sortable/sortable-3";
import { Sortable4Example } from "@/components/component-gallery/examples/sortable/sortable-4";
import { Sortable5Example } from "@/components/component-gallery/examples/sortable/sortable-5";
import { Sortable6Example } from "@/components/component-gallery/examples/sortable/sortable-6";
import { Sortable7Example } from "@/components/component-gallery/examples/sortable/sortable-7";
import { Sortable8Example } from "@/components/component-gallery/examples/sortable/sortable-8";

export const SORTABLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-sortable-1", label: "File List", component: Sortable1Example },
	{ id: "c-sortable-2", label: "Grid Layout", component: Sortable2Example },
	{ id: "c-sortable-3", label: "Nested Layout", component: Sortable3Example },
	{ id: "c-sortable-4", label: "Playlist", component: Sortable4Example },
	{ id: "c-sortable-5", label: "Settings Priority", component: Sortable5Example },
	{ id: "c-sortable-6", label: "Sidebar Navigation", component: Sortable6Example },
	{ id: "c-sortable-7", label: "Image Gallery", component: Sortable7Example },
	{ id: "c-sortable-8", label: "Persisted Order", component: Sortable8Example },
];

export function SortableExamples(): React.JSX.Element {
	return <ExampleGrid examples={SORTABLE_EXAMPLES} />;
}
