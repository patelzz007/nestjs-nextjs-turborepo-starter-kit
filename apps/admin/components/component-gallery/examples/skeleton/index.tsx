"use client";

// The Skeleton examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Skeleton1Example } from "@/components/component-gallery/examples/skeleton/skeleton-1";
import { Skeleton2Example } from "@/components/component-gallery/examples/skeleton/skeleton-2";
import { Skeleton3Example } from "@/components/component-gallery/examples/skeleton/skeleton-3";
import { Skeleton4Example } from "@/components/component-gallery/examples/skeleton/skeleton-4";
import { Skeleton5Example } from "@/components/component-gallery/examples/skeleton/skeleton-5";
import { Skeleton6Example } from "@/components/component-gallery/examples/skeleton/skeleton-6";
import { Skeleton7Example } from "@/components/component-gallery/examples/skeleton/skeleton-7";
import { Skeleton8Example } from "@/components/component-gallery/examples/skeleton/skeleton-8";
import { Skeleton9Example } from "@/components/component-gallery/examples/skeleton/skeleton-9";
import { Skeleton10Example } from "@/components/component-gallery/examples/skeleton/skeleton-10";

export const SKELETON_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-skeleton-1", label: "Avatar Info", component: Skeleton1Example },
	{ id: "c-skeleton-2", label: "Card", component: Skeleton2Example },
	{ id: "c-skeleton-3", label: "Text Paragraphs", component: Skeleton3Example },
	{ id: "c-skeleton-4", label: "Form", component: Skeleton4Example },
	{ id: "c-skeleton-5", label: "Data Table", component: Skeleton5Example },
	{ id: "c-skeleton-6", label: "Stats Row", component: Skeleton6Example },
	{ id: "c-skeleton-7", label: "List With Actions", component: Skeleton7Example },
	{ id: "c-skeleton-8", label: "Card Grid", component: Skeleton8Example },
	{ id: "c-skeleton-9", label: "Profile Page", component: Skeleton9Example },
	{ id: "c-skeleton-10", label: "Chat Messages", component: Skeleton10Example },
];

export function SkeletonExamples(): React.JSX.Element {
	return <ExampleGrid examples={SKELETON_EXAMPLES} />;
}
