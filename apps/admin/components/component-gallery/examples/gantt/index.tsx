"use client";

// The Gantt examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Gantt1Example } from "@/components/component-gallery/examples/gantt/gantt-1";
import { Gantt2Example } from "@/components/component-gallery/examples/gantt/gantt-2";
import { Gantt3Example } from "@/components/component-gallery/examples/gantt/gantt-3";
import { Gantt4Example } from "@/components/component-gallery/examples/gantt/gantt-4";
import { Gantt5Example } from "@/components/component-gallery/examples/gantt/gantt-5";
import { Gantt6Example } from "@/components/component-gallery/examples/gantt/gantt-6";
import { Gantt7Example } from "@/components/component-gallery/examples/gantt/gantt-7";

export const GANTT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-gantt-1", label: "Settings Menu", component: Gantt1Example },
	{ id: "c-gantt-2", label: "Drag Reorder", component: Gantt2Example },
	{ id: "c-gantt-3", label: "Quarter Roadmap", component: Gantt3Example },
	{ id: "c-gantt-4", label: "Capacity Board", component: Gantt4Example },
	{ id: "c-gantt-5", label: "Task Table", component: Gantt5Example },
	{ id: "c-gantt-6", label: "Baseline Tracking", component: Gantt6Example },
	{ id: "c-gantt-7", label: "Dependencies & Milestones", component: Gantt7Example },
];

export function GanttExamples(): React.JSX.Element {
	return <ExampleGrid examples={GANTT_EXAMPLES} />;
}
