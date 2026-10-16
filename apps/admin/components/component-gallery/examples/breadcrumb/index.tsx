"use client";

// The Breadcrumb examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Breadcrumb1Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-1";
import { Breadcrumb2Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-2";
import { Breadcrumb3Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-3";
import { Breadcrumb4Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-4";
import { Breadcrumb5Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-5";
import { Breadcrumb6Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-6";
import { Breadcrumb7Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-7";
import { Breadcrumb8Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-8";
import { Breadcrumb9Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-9";
import { Breadcrumb10Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-10";
import { Breadcrumb11Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-11";
import { Breadcrumb12Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-12";
import { Breadcrumb13Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-13";
import { Breadcrumb14Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-14";
import { Breadcrumb15Example } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-15";

export const BREADCRUMB_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-breadcrumb-1", label: "Basic", component: Breadcrumb1Example },
	{ id: "c-breadcrumb-2", label: "Dropdown Menu", component: Breadcrumb2Example },
	{ id: "c-breadcrumb-3", label: "Router Link", component: Breadcrumb3Example },
	{ id: "c-breadcrumb-4", label: "Slash Separator", component: Breadcrumb4Example },
	{ id: "c-breadcrumb-5", label: "Item Icons", component: Breadcrumb5Example },
	{ id: "c-breadcrumb-6", label: "Static Ellipsis", component: Breadcrumb6Example },
	{ id: "c-breadcrumb-7", label: "Avatars", component: Breadcrumb7Example },
	{ id: "c-breadcrumb-8", label: "Double Chevron", component: Breadcrumb8Example },
	{ id: "c-breadcrumb-9", label: "In Card", component: Breadcrumb9Example },
	{ id: "c-breadcrumb-10", label: "Pill In Frame", component: Breadcrumb10Example },
	{ id: "c-breadcrumb-11", label: "Count Badge", component: Breadcrumb11Example },
	{ id: "c-breadcrumb-12", label: "Home Icon Button", component: Breadcrumb12Example },
	{ id: "c-breadcrumb-13", label: "Bar Separator", component: Breadcrumb13Example },
	{ id: "c-breadcrumb-14", label: "Button Style", component: Breadcrumb14Example },
	{ id: "c-breadcrumb-15", label: "Project & Document", component: Breadcrumb15Example },
];

export function BreadcrumbExamples(): React.JSX.Element {
	return <ExampleGrid examples={BREADCRUMB_EXAMPLES} />;
}
