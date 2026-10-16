"use client";

// The Input examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Input1Example } from "@/components/component-gallery/examples/input/input-1";
import { Input2Example } from "@/components/component-gallery/examples/input/input-2";
import { Input3Example } from "@/components/component-gallery/examples/input/input-3";
import { Input4Example } from "@/components/component-gallery/examples/input/input-4";
import { Input5Example } from "@/components/component-gallery/examples/input/input-5";
import { Input6Example } from "@/components/component-gallery/examples/input/input-6";
import { Input7Example } from "@/components/component-gallery/examples/input/input-7";
import { Input8Example } from "@/components/component-gallery/examples/input/input-8";
import { Input9Example } from "@/components/component-gallery/examples/input/input-9";
import { Input10Example } from "@/components/component-gallery/examples/input/input-10";
import { Input11Example } from "@/components/component-gallery/examples/input/input-11";
import { Input12Example } from "@/components/component-gallery/examples/input/input-12";
import { Input13Example } from "@/components/component-gallery/examples/input/input-13";
import { Input14Example } from "@/components/component-gallery/examples/input/input-14";
import { Input15Example } from "@/components/component-gallery/examples/input/input-15";
import { Input16Example } from "@/components/component-gallery/examples/input/input-16";
import { Input17Example } from "@/components/component-gallery/examples/input/input-17";
import { Input18Example } from "@/components/component-gallery/examples/input/input-18";
import { Input19Example } from "@/components/component-gallery/examples/input/input-19";
import { Input20Example } from "@/components/component-gallery/examples/input/input-20";
import { Input21Example } from "@/components/component-gallery/examples/input/input-21";
import { Input22Example } from "@/components/component-gallery/examples/input/input-22";
import { Input23Example } from "@/components/component-gallery/examples/input/input-23";
import { Input24Example } from "@/components/component-gallery/examples/input/input-24";
import { Input25Example } from "@/components/component-gallery/examples/input/input-25";
import { Input26Example } from "@/components/component-gallery/examples/input/input-26";
import { Input27Example } from "@/components/component-gallery/examples/input/input-27";
import { Input28Example } from "@/components/component-gallery/examples/input/input-28";
import { Input29Example } from "@/components/component-gallery/examples/input/input-29";
import { Input30Example } from "@/components/component-gallery/examples/input/input-30";
import { Input31Example } from "@/components/component-gallery/examples/input/input-31";

export const INPUT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-input-1", label: "Basic", component: Input1Example },
	{ id: "c-input-2", label: "With Label", component: Input2Example },
	{ id: "c-input-3", label: "With Description", component: Input3Example },
	{ id: "c-input-4", label: "Disabled", component: Input4Example },
	{ id: "c-input-5", label: "Error Message", component: Input5Example },
	{ id: "c-input-6", label: "Character Counter", component: Input6Example },
	{ id: "c-input-7", label: "Password", component: Input7Example },
	{ id: "c-input-8", label: "Phone", component: Input8Example },
	{ id: "c-input-9", label: "URL", component: Input9Example },
	{ id: "c-input-10", label: "Number", component: Input10Example },
	{ id: "c-input-11", label: "Date", component: Input11Example },
	{ id: "c-input-12", label: "File", component: Input12Example },
	{ id: "c-input-13", label: "Required Indicator", component: Input13Example },
	{ id: "c-input-14", label: "Time", component: Input14Example },
	{ id: "c-input-15", label: "Contact Form", component: Input15Example },
	{ id: "c-input-16", label: "Label Tooltip", component: Input16Example },
	{ id: "c-input-17", label: "Label Badge", component: Input17Example },
	{ id: "c-input-18", label: "Optional Badge", component: Input18Example },
	{ id: "c-input-19", label: "Link & Toggle", component: Input19Example },
	{ id: "c-input-20", label: "Horizontal", component: Input20Example },
	{ id: "c-input-21", label: "Multiple Errors", component: Input21Example },
	{ id: "c-input-22", label: "Strength Hint", component: Input22Example },
	{ id: "c-input-23", label: "Strength Meter", component: Input23Example },
	{ id: "c-input-24", label: "Pulsed Background", component: Input24Example },
	{ id: "c-input-25", label: "Custom Focus Ring", component: Input25Example },
	{ id: "c-input-26", label: "Subtle Background", component: Input26Example },
	{ id: "c-input-27", label: "Bottom Border", component: Input27Example },
	{ id: "c-input-28", label: "Color", component: Input28Example },
	{ id: "c-input-29", label: "Range", component: Input29Example },
	{ id: "c-input-30", label: "Pill Shape", component: Input30Example },
	{ id: "c-input-31", label: "Borderless", component: Input31Example },
];

export function InputExamples(): React.JSX.Element {
	return <ExampleGrid examples={INPUT_EXAMPLES} />;
}
