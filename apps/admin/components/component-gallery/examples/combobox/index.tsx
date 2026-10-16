"use client";

// The Combobox examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Combobox1Example } from "@/components/component-gallery/examples/combobox/combobox-1";
import { Combobox2Example } from "@/components/component-gallery/examples/combobox/combobox-2";
import { Combobox3Example } from "@/components/component-gallery/examples/combobox/combobox-3";
import { Combobox4Example } from "@/components/component-gallery/examples/combobox/combobox-4";
import { Combobox5Example } from "@/components/component-gallery/examples/combobox/combobox-5";
import { Combobox6Example } from "@/components/component-gallery/examples/combobox/combobox-6";
import { Combobox7Example } from "@/components/component-gallery/examples/combobox/combobox-7";
import { Combobox8Example } from "@/components/component-gallery/examples/combobox/combobox-8";
import { Combobox9Example } from "@/components/component-gallery/examples/combobox/combobox-9";
import { Combobox10Example } from "@/components/component-gallery/examples/combobox/combobox-10";
import { Combobox11Example } from "@/components/component-gallery/examples/combobox/combobox-11";
import { Combobox12Example } from "@/components/component-gallery/examples/combobox/combobox-12";
import { Combobox13Example } from "@/components/component-gallery/examples/combobox/combobox-13";
import { Combobox14Example } from "@/components/component-gallery/examples/combobox/combobox-14";
import { Combobox15Example } from "@/components/component-gallery/examples/combobox/combobox-15";
import { Combobox16Example } from "@/components/component-gallery/examples/combobox/combobox-16";
import { Combobox17Example } from "@/components/component-gallery/examples/combobox/combobox-17";
import { Combobox18Example } from "@/components/component-gallery/examples/combobox/combobox-18";
import { Combobox19Example } from "@/components/component-gallery/examples/combobox/combobox-19";
import { Combobox20Example } from "@/components/component-gallery/examples/combobox/combobox-20";
import { Combobox21Example } from "@/components/component-gallery/examples/combobox/combobox-21";
import { Combobox22Example } from "@/components/component-gallery/examples/combobox/combobox-22";
import { Combobox23Example } from "@/components/component-gallery/examples/combobox/combobox-23";
import { Combobox24Example } from "@/components/component-gallery/examples/combobox/combobox-24";
import { Combobox25Example } from "@/components/component-gallery/examples/combobox/combobox-25";
import { Combobox26Example } from "@/components/component-gallery/examples/combobox/combobox-26";
import { Combobox27Example } from "@/components/component-gallery/examples/combobox/combobox-27";
import { Combobox28Example } from "@/components/component-gallery/examples/combobox/combobox-28";

export const COMBOBOX_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-combobox-1", label: "Basic", component: Combobox1Example },
	{ id: "c-combobox-2", label: "Disabled", component: Combobox2Example },
	{ id: "c-combobox-3", label: "Invalid", component: Combobox3Example },
	{ id: "c-combobox-4", label: "Clear Button", component: Combobox4Example },
	{ id: "c-combobox-5", label: "Auto-Highlight", component: Combobox5Example },
	{ id: "c-combobox-6", label: "Grouped Options", component: Combobox6Example },
	{ id: "c-combobox-7", label: "Group Separators", component: Combobox7Example },
	{ id: "c-combobox-8", label: "Large List", component: Combobox8Example },
	{ id: "c-combobox-9", label: "Icon Addon", component: Combobox9Example },
	{ id: "c-combobox-10", label: "Country Picker", component: Combobox10Example },
	{ id: "c-combobox-11", label: "In Form", component: Combobox11Example },
	{ id: "c-combobox-12", label: "Multi-Select", component: Combobox12Example },
	{ id: "c-combobox-13", label: "Disabled Multi-Select", component: Combobox13Example },
	{ id: "c-combobox-14", label: "Invalid Multi-Select", component: Combobox14Example },
	{ id: "c-combobox-15", label: "Non-Removable Chips", component: Combobox15Example },
	{ id: "c-combobox-16", label: "Custom Items", component: Combobox16Example },
	{ id: "c-combobox-17", label: "In Dialog", component: Combobox17Example },
	{ id: "c-combobox-18", label: "Custom Trigger Icon", component: Combobox18Example },
	{ id: "c-combobox-19", label: "User Tags", component: Combobox19Example },
	{ id: "c-combobox-20", label: "Invisible Tags", component: Combobox20Example },
	{ id: "c-combobox-21", label: "Status Change", component: Combobox21Example },
	{ id: "c-combobox-22", label: "Priority Change", component: Combobox22Example },
	{ id: "c-combobox-23", label: "Lead Selection", component: Combobox23Example },
	{ id: "c-combobox-24", label: "Member Selection", component: Combobox24Example },
	{ id: "c-combobox-25", label: "Date Selection", component: Combobox25Example },
	{ id: "c-combobox-26", label: "Label Selection", component: Combobox26Example },
	{ id: "c-combobox-27", label: "Team Selection", component: Combobox27Example },
	{ id: "c-combobox-28", label: "Assignee Selection", component: Combobox28Example },
];

export function ComboboxExamples(): React.JSX.Element {
	return <ExampleGrid examples={COMBOBOX_EXAMPLES} />;
}
