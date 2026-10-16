"use client";

// The Pagination examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Pagination1Example } from "@/components/component-gallery/examples/pagination/pagination-1";
import { Pagination2Example } from "@/components/component-gallery/examples/pagination/pagination-2";
import { Pagination3Example } from "@/components/component-gallery/examples/pagination/pagination-3";
import { Pagination4Example } from "@/components/component-gallery/examples/pagination/pagination-4";
import { Pagination5Example } from "@/components/component-gallery/examples/pagination/pagination-5";
import { Pagination6Example } from "@/components/component-gallery/examples/pagination/pagination-6";
import { Pagination7Example } from "@/components/component-gallery/examples/pagination/pagination-7";
import { Pagination8Example } from "@/components/component-gallery/examples/pagination/pagination-8";
import { Pagination9Example } from "@/components/component-gallery/examples/pagination/pagination-9";
import { Pagination10Example } from "@/components/component-gallery/examples/pagination/pagination-10";
import { Pagination11Example } from "@/components/component-gallery/examples/pagination/pagination-11";
import { Pagination12Example } from "@/components/component-gallery/examples/pagination/pagination-12";
import { Pagination13Example } from "@/components/component-gallery/examples/pagination/pagination-13";
import { Pagination14Example } from "@/components/component-gallery/examples/pagination/pagination-14";
import { Pagination15Example } from "@/components/component-gallery/examples/pagination/pagination-15";

export const PAGINATION_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-pagination-1", label: "Basic", component: Pagination1Example },
	{ id: "c-pagination-2", label: "No Labels", component: Pagination2Example },
	{ id: "c-pagination-3", label: "Hover Border", component: Pagination3Example },
	{ id: "c-pagination-4", label: "Circle Buttons", component: Pagination4Example },
	{ id: "c-pagination-5", label: "Compact Go-To", component: Pagination5Example },
	{ id: "c-pagination-6", label: "In Card", component: Pagination6Example },
	{ id: "c-pagination-7", label: "Arrow Links", component: Pagination7Example },
	{ id: "c-pagination-8", label: "Centered Page Info", component: Pagination8Example },
	{ id: "c-pagination-9", label: "Left Page Info", component: Pagination9Example },
	{ id: "c-pagination-10", label: "Trailing Ellipsis", component: Pagination10Example },
	{ id: "c-pagination-11", label: "Outline Strip", component: Pagination11Example },
	{ id: "c-pagination-12", label: "Rows Per Page", component: Pagination12Example },
	{ id: "c-pagination-13", label: "Page Select", component: Pagination13Example },
	{ id: "c-pagination-14", label: "Full Width Go-To", component: Pagination14Example },
	{ id: "c-pagination-15", label: "Info & Per-Page", component: Pagination15Example },
];

export function PaginationExamples(): React.JSX.Element {
	return <ExampleGrid examples={PAGINATION_EXAMPLES} />;
}
