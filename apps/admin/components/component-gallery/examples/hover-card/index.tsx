"use client";

// The HoverCard examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { HoverCard1Example } from "@/components/component-gallery/examples/hover-card/hover-card-1";
import { HoverCard2Example } from "@/components/component-gallery/examples/hover-card/hover-card-2";
import { HoverCard3Example } from "@/components/component-gallery/examples/hover-card/hover-card-3";
import { HoverCard4Example } from "@/components/component-gallery/examples/hover-card/hover-card-4";
import { HoverCard5Example } from "@/components/component-gallery/examples/hover-card/hover-card-5";
import { HoverCard6Example } from "@/components/component-gallery/examples/hover-card/hover-card-6";
import { HoverCard7Example } from "@/components/component-gallery/examples/hover-card/hover-card-7";
import { HoverCard8Example } from "@/components/component-gallery/examples/hover-card/hover-card-8";

export const HOVER_CARD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-hover-card-1", label: "Basic", component: HoverCard1Example },
	{ id: "c-hover-card-2", label: "Positions", component: HoverCard2Example },
	{ id: "c-hover-card-3", label: "Profile", component: HoverCard3Example },
	{ id: "c-hover-card-4", label: "Icon", component: HoverCard4Example },
	{ id: "c-hover-card-5", label: "Image & Text", component: HoverCard5Example },
	{ id: "c-hover-card-6", label: "In Dialog", component: HoverCard6Example },
	{ id: "c-hover-card-7", label: "Live Timestamp", component: HoverCard7Example },
	{ id: "c-hover-card-8", label: "Release Notes", component: HoverCard8Example },
];

export function HoverCardExamples(): React.JSX.Element {
	return <ExampleGrid examples={HOVER_CARD_EXAMPLES} />;
}
