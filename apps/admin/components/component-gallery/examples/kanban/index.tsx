"use client";

// The Kanban examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Kanban1Example } from "@/components/component-gallery/examples/kanban/kanban-1";
import { Kanban2Example } from "@/components/component-gallery/examples/kanban/kanban-2";
import { Kanban3Example } from "@/components/component-gallery/examples/kanban/kanban-3";
import { Kanban4Example } from "@/components/component-gallery/examples/kanban/kanban-4";
import { Kanban5Example } from "@/components/component-gallery/examples/kanban/kanban-5";
import { Kanban6Example } from "@/components/component-gallery/examples/kanban/kanban-6";

export const KANBAN_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-kanban-1", label: "Placeholder Overlay", component: Kanban1Example },
	{ id: "c-kanban-2", label: "Dynamic Overlay", component: Kanban2Example },
	{ id: "c-kanban-3", label: "Frame Columns", component: Kanban3Example },
	{ id: "c-kanban-4", label: "Stacked Frame", component: Kanban4Example },
	{ id: "c-kanban-5", label: "Feature Roadmap", component: Kanban5Example },
	{ id: "c-kanban-6", label: "Persisted Moves", component: Kanban6Example },
];

export function KanbanExamples(): React.JSX.Element {
	return <ExampleGrid examples={KANBAN_EXAMPLES} />;
}
