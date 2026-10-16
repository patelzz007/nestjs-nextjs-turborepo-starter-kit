"use client";

// The Timeline examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Timeline1Example } from "@/components/component-gallery/examples/timeline/timeline-1";
import { Timeline2Example } from "@/components/component-gallery/examples/timeline/timeline-2";
import { Timeline3Example } from "@/components/component-gallery/examples/timeline/timeline-3";
import { Timeline4Example } from "@/components/component-gallery/examples/timeline/timeline-4";
import { Timeline5Example } from "@/components/component-gallery/examples/timeline/timeline-5";
import { Timeline6Example } from "@/components/component-gallery/examples/timeline/timeline-6";
import { Timeline7Example } from "@/components/component-gallery/examples/timeline/timeline-7";
import { Timeline8Example } from "@/components/component-gallery/examples/timeline/timeline-8";
import { Timeline9Example } from "@/components/component-gallery/examples/timeline/timeline-9";
import { Timeline10Example } from "@/components/component-gallery/examples/timeline/timeline-10";
import { Timeline11Example } from "@/components/component-gallery/examples/timeline/timeline-11";
import { Timeline12Example } from "@/components/component-gallery/examples/timeline/timeline-12";

export const TIMELINE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-timeline-1", label: "Basic", component: Timeline1Example },
	{ id: "c-timeline-2", label: "Roadmap", component: Timeline2Example },
	{ id: "c-timeline-3", label: "Order Status", component: Timeline3Example },
	{ id: "c-timeline-4", label: "Git Activity", component: Timeline4Example },
	{ id: "c-timeline-5", label: "Milestones", component: Timeline5Example },
	{ id: "c-timeline-6", label: "Pipeline Steps", component: Timeline6Example },
	{ id: "c-timeline-7", label: "Roadmap Items", component: Timeline7Example },
	{ id: "c-timeline-8", label: "Horizontal", component: Timeline8Example },
	{ id: "c-timeline-9", label: "Leading Labels", component: Timeline9Example },
	{ id: "c-timeline-10", label: "Deployment Log", component: Timeline10Example },
	{ id: "c-timeline-11", label: "Avatar Activity", component: Timeline11Example },
	{ id: "c-timeline-12", label: "Compact Milestones", component: Timeline12Example },
];

export function TimelineExamples(): React.JSX.Element {
	return <ExampleGrid examples={TIMELINE_EXAMPLES} />;
}
