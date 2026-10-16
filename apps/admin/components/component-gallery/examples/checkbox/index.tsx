"use client";

// The Checkbox examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Checkbox1Example } from "@/components/component-gallery/examples/checkbox/checkbox-1";
import { Checkbox2Example } from "@/components/component-gallery/examples/checkbox/checkbox-2";
import { Checkbox3Example } from "@/components/component-gallery/examples/checkbox/checkbox-3";
import { Checkbox4Example } from "@/components/component-gallery/examples/checkbox/checkbox-4";
import { Checkbox5Example } from "@/components/component-gallery/examples/checkbox/checkbox-5";
import { Checkbox6Example } from "@/components/component-gallery/examples/checkbox/checkbox-6";
import { Checkbox7Example } from "@/components/component-gallery/examples/checkbox/checkbox-7";
import { Checkbox8Example } from "@/components/component-gallery/examples/checkbox/checkbox-8";
import { Checkbox9Example } from "@/components/component-gallery/examples/checkbox/checkbox-9";
import { Checkbox10Example } from "@/components/component-gallery/examples/checkbox/checkbox-10";
import { Checkbox11Example } from "@/components/component-gallery/examples/checkbox/checkbox-11";
import { Checkbox12Example } from "@/components/component-gallery/examples/checkbox/checkbox-12";
import { Checkbox13Example } from "@/components/component-gallery/examples/checkbox/checkbox-13";
import { Checkbox14Example } from "@/components/component-gallery/examples/checkbox/checkbox-14";
import { Checkbox15Example } from "@/components/component-gallery/examples/checkbox/checkbox-15";
import { Checkbox16Example } from "@/components/component-gallery/examples/checkbox/checkbox-16";
import { Checkbox17Example } from "@/components/component-gallery/examples/checkbox/checkbox-17";
import { Checkbox18Example } from "@/components/component-gallery/examples/checkbox/checkbox-18";
import { Checkbox19Example } from "@/components/component-gallery/examples/checkbox/checkbox-19";
import { Checkbox20Example } from "@/components/component-gallery/examples/checkbox/checkbox-20";
import { Checkbox21Example } from "@/components/component-gallery/examples/checkbox/checkbox-21";
import { Checkbox22Example } from "@/components/component-gallery/examples/checkbox/checkbox-22";

export const CHECKBOX_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-checkbox-1", label: "Basic", component: Checkbox1Example },
	{ id: "c-checkbox-2", label: "Disabled", component: Checkbox2Example },
	{ id: "c-checkbox-3", label: "Invalid", component: Checkbox3Example },
	{ id: "c-checkbox-4", label: "Indeterminate", component: Checkbox4Example },
	{ id: "c-checkbox-5", label: "Label & Description", component: Checkbox5Example },
	{ id: "c-checkbox-6", label: "Colored", component: Checkbox6Example },
	{ id: "c-checkbox-7", label: "Circle To-Do", component: Checkbox7Example },
	{ id: "c-checkbox-8", label: "Basic Group", component: Checkbox8Example },
	{ id: "c-checkbox-9", label: "Setting Card", component: Checkbox9Example },
	{ id: "c-checkbox-10", label: "Frame Group", component: Checkbox10Example },
	{ id: "c-checkbox-11", label: "Card Rows", component: Checkbox11Example },
	{ id: "c-checkbox-12", label: "Icon Card Rows", component: Checkbox12Example },
	{ id: "c-checkbox-13", label: "Corner Check Tiles", component: Checkbox13Example },
	{ id: "c-checkbox-14", label: "Module Tiles", component: Checkbox14Example },
	{ id: "c-checkbox-15", label: "Avatar Card", component: Checkbox15Example },
	{ id: "c-checkbox-16", label: "Nested Permissions", component: Checkbox16Example },
	{ id: "c-checkbox-17", label: "Payment Method", component: Checkbox17Example },
	{ id: "c-checkbox-18", label: "Help Icon Tooltip", component: Checkbox18Example },
	{ id: "c-checkbox-19", label: "Badge Group", component: Checkbox19Example },
	{ id: "c-checkbox-20", label: "Right Side Tooltip", component: Checkbox20Example },
	{ id: "c-checkbox-21", label: "Inline Group", component: Checkbox21Example },
	{ id: "c-checkbox-22", label: "Uppercase Badges", component: Checkbox22Example },
];

export function CheckboxExamples(): React.JSX.Element {
	return <ExampleGrid examples={CHECKBOX_EXAMPLES} />;
}
