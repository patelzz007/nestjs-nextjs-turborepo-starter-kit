"use client";

// The Select examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Select1Example } from "@/components/component-gallery/examples/select/select-1";
import { Select2Example } from "@/components/component-gallery/examples/select/select-2";
import { Select3Example } from "@/components/component-gallery/examples/select/select-3";
import { Select4Example } from "@/components/component-gallery/examples/select/select-4";
import { Select5Example } from "@/components/component-gallery/examples/select/select-5";
import { Select6Example } from "@/components/component-gallery/examples/select/select-6";
import { Select7Example } from "@/components/component-gallery/examples/select/select-7";
import { Select8Example } from "@/components/component-gallery/examples/select/select-8";
import { Select9Example } from "@/components/component-gallery/examples/select/select-9";
import { Select10Example } from "@/components/component-gallery/examples/select/select-10";
import { Select11Example } from "@/components/component-gallery/examples/select/select-11";
import { Select12Example } from "@/components/component-gallery/examples/select/select-12";
import { Select13Example } from "@/components/component-gallery/examples/select/select-13";
import { Select14Example } from "@/components/component-gallery/examples/select/select-14";
import { Select15Example } from "@/components/component-gallery/examples/select/select-15";
import { Select16Example } from "@/components/component-gallery/examples/select/select-16";
import { Select17Example } from "@/components/component-gallery/examples/select/select-17";
import { Select18Example } from "@/components/component-gallery/examples/select/select-18";
import { Select19Example } from "@/components/component-gallery/examples/select/select-19";
import { Select20Example } from "@/components/component-gallery/examples/select/select-20";
import { Select21Example } from "@/components/component-gallery/examples/select/select-21";
import { Select22Example } from "@/components/component-gallery/examples/select/select-22";
import { Select23Example } from "@/components/component-gallery/examples/select/select-23";
import { Select24Example } from "@/components/component-gallery/examples/select/select-24";
import { Select25Example } from "@/components/component-gallery/examples/select/select-25";
import { Select26Example } from "@/components/component-gallery/examples/select/select-26";
import { Select27Example } from "@/components/component-gallery/examples/select/select-27";
import { Select28Example } from "@/components/component-gallery/examples/select/select-28";
import { Select29Example } from "@/components/component-gallery/examples/select/select-29";
import { Select30Example } from "@/components/component-gallery/examples/select/select-30";
import { Select31Example } from "@/components/component-gallery/examples/select/select-31";
import { Select32Example } from "@/components/component-gallery/examples/select/select-32";
import { Select33Example } from "@/components/component-gallery/examples/select/select-33";

export const SELECT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-select-1", label: "Basic", component: Select1Example },
	{ id: "c-select-2", label: "Icons", component: Select2Example },
	{ id: "c-select-3", label: "Grouped Labels", component: Select3Example },
	{ id: "c-select-4", label: "Large List", component: Select4Example },
	{ id: "c-select-5", label: "Small Trigger", component: Select5Example },
	{ id: "c-select-6", label: "Plan Picker", component: Select6Example },
	{ id: "c-select-7", label: "Disabled Item", component: Select7Example },
	{ id: "c-select-8", label: "Field With Label", component: Select8Example },
	{ id: "c-select-9", label: "Invalid", component: Select9Example },
	{ id: "c-select-10", label: "Disabled", component: Select10Example },
	{ id: "c-select-11", label: "In Dialog", component: Select11Example },
	{ id: "c-select-12", label: "Multiple Selection", component: Select12Example },
	{ id: "c-select-13", label: "Inline With Input", component: Select13Example },
	{ id: "c-select-14", label: "With Button", component: Select14Example },
	{ id: "c-select-15", label: "Item Aligned", component: Select15Example },
	{ id: "c-select-16", label: "Access Levels", component: Select16Example },
	{ id: "c-select-17", label: "Status Bullets", component: Select17Example },
	{ id: "c-select-18", label: "User Avatars", component: Select18Example },
	{ id: "c-select-19", label: "Status Badges", component: Select19Example },
	{ id: "c-select-20", label: "Left Indicator", component: Select20Example },
	{ id: "c-select-21", label: "Clear Button", component: Select21Example },
	{ id: "c-select-22", label: "Custom Chevrons", component: Select22Example },
	{ id: "c-select-23", label: "Overlapping Dots", component: Select23Example },
	{ id: "c-select-24", label: "Grouped Separators", component: Select24Example },
	{ id: "c-select-25", label: "Country Flags", component: Select25Example },
	{ id: "c-select-26", label: "Status Filter", component: Select26Example },
	{ id: "c-select-27", label: "Option Descriptions", component: Select27Example },
	{ id: "c-select-28", label: "Timezone Offsets", component: Select28Example },
	{ id: "c-select-29", label: "Team Assignment", component: Select29Example },
	{ id: "c-select-30", label: "Priority Badges", component: Select30Example },
	{ id: "c-select-31", label: "Font Preview", component: Select31Example },
	{ id: "c-select-32", label: "Category Icons", component: Select32Example },
	{ id: "c-select-33", label: "Size Scale", component: Select33Example },
];

export function SelectExamples(): React.JSX.Element {
	return <ExampleGrid examples={SELECT_EXAMPLES} />;
}
