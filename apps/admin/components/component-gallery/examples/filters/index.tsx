"use client";

// The Filters examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Filters1Example } from "@/components/component-gallery/examples/filters/filters-1";
import { Filters2Example } from "@/components/component-gallery/examples/filters/filters-2";
import { Filters3Example } from "@/components/component-gallery/examples/filters/filters-3";
import { Filters4Example } from "@/components/component-gallery/examples/filters/filters-4";
import { Filters5Example } from "@/components/component-gallery/examples/filters/filters-5";
import { Filters6Example } from "@/components/component-gallery/examples/filters/filters-6";
import { Filters7Example } from "@/components/component-gallery/examples/filters/filters-7";
import { Filters8Example } from "@/components/component-gallery/examples/filters/filters-8";
import { Filters9Example } from "@/components/component-gallery/examples/filters/filters-9";
import { Filters10Example } from "@/components/component-gallery/examples/filters/filters-10";
import { Filters11Example } from "@/components/component-gallery/examples/filters/filters-11";
import { Filters12Example } from "@/components/component-gallery/examples/filters/filters-12";

export const FILTERS_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-filters-1", label: "Full Filter Bar", component: Filters1Example },
	{ id: "c-filters-2", label: "Nested Attributes", component: Filters2Example },
	{ id: "c-filters-3", label: "Status Badges", component: Filters3Example },
	{ id: "c-filters-4", label: "Avatars & Paging", component: Filters4Example },
	{ id: "c-filters-5", label: "Date Editors", component: Filters5Example },
	{ id: "c-filters-6", label: "Slider Editor", component: Filters6Example },
	{ id: "c-filters-7", label: "Table Filtering", component: Filters7Example },
	{ id: "c-filters-8", label: "Choice Controls", component: Filters8Example },
	{ id: "c-filters-9", label: "Typed Inputs", component: Filters9Example },
	{ id: "c-filters-10", label: "Popover Builder", component: Filters10Example },
	{ id: "c-filters-11", label: "Inline Builder", component: Filters11Example },
	{ id: "c-filters-12", label: "Controlled & Translated", component: Filters12Example },
];

export function FiltersExamples(): React.JSX.Element {
	return <ExampleGrid examples={FILTERS_EXAMPLES} />;
}
