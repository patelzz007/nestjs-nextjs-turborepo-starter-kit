"use client";

// The DateSelector examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { DateSelector1Example } from "@/components/component-gallery/examples/date-selector/date-selector-1";
import { DateSelector2Example } from "@/components/component-gallery/examples/date-selector/date-selector-2";
import { DateSelector3Example } from "@/components/component-gallery/examples/date-selector/date-selector-3";
import { DateSelector4Example } from "@/components/component-gallery/examples/date-selector/date-selector-4";

export const DATE_SELECTOR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-date-selector-1", label: "Basic Inline", component: DateSelector1Example },
	{ id: "c-date-selector-2", label: "Popover", component: DateSelector2Example },
	{ id: "c-date-selector-3", label: "Dialog", component: DateSelector3Example },
	{ id: "c-date-selector-4", label: "Language Menu", component: DateSelector4Example },
];

export function DateSelectorExamples(): React.JSX.Element {
	return <ExampleGrid examples={DATE_SELECTOR_EXAMPLES} />;
}
