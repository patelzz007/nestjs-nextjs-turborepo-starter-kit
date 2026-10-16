"use client";

// The RadioGroup examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { RadioGroup1Example } from "@/components/component-gallery/examples/radio-group/radio-group-1";
import { RadioGroup2Example } from "@/components/component-gallery/examples/radio-group/radio-group-2";
import { RadioGroup3Example } from "@/components/component-gallery/examples/radio-group/radio-group-3";
import { RadioGroup4Example } from "@/components/component-gallery/examples/radio-group/radio-group-4";
import { RadioGroup5Example } from "@/components/component-gallery/examples/radio-group/radio-group-5";
import { RadioGroup6Example } from "@/components/component-gallery/examples/radio-group/radio-group-6";
import { RadioGroup7Example } from "@/components/component-gallery/examples/radio-group/radio-group-7";
import { RadioGroup8Example } from "@/components/component-gallery/examples/radio-group/radio-group-8";
import { RadioGroup9Example } from "@/components/component-gallery/examples/radio-group/radio-group-9";
import { RadioGroup10Example } from "@/components/component-gallery/examples/radio-group/radio-group-10";
import { RadioGroup11Example } from "@/components/component-gallery/examples/radio-group/radio-group-11";
import { RadioGroup12Example } from "@/components/component-gallery/examples/radio-group/radio-group-12";
import { RadioGroup13Example } from "@/components/component-gallery/examples/radio-group/radio-group-13";
import { RadioGroup14Example } from "@/components/component-gallery/examples/radio-group/radio-group-14";
import { RadioGroup15Example } from "@/components/component-gallery/examples/radio-group/radio-group-15";
import { RadioGroup16Example } from "@/components/component-gallery/examples/radio-group/radio-group-16";
import { RadioGroup17Example } from "@/components/component-gallery/examples/radio-group/radio-group-17";

export const RADIO_GROUP_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-radio-group-1", label: "Basic", component: RadioGroup1Example },
	{ id: "c-radio-group-2", label: "Disabled", component: RadioGroup2Example },
	{ id: "c-radio-group-3", label: "Descriptions", component: RadioGroup3Example },
	{ id: "c-radio-group-4", label: "Invalid", component: RadioGroup4Example },
	{ id: "c-radio-group-5", label: "Colored", component: RadioGroup5Example },
	{ id: "c-radio-group-6", label: "Legend & Description", component: RadioGroup6Example },
	{ id: "c-radio-group-7", label: "Descriptive Cards", component: RadioGroup7Example },
	{ id: "c-radio-group-8", label: "Card Separators", component: RadioGroup8Example },
	{ id: "c-radio-group-9", label: "Card Icons", component: RadioGroup9Example },
	{ id: "c-radio-group-10", label: "In Frame", component: RadioGroup10Example },
	{ id: "c-radio-group-11", label: "Grid Layout", component: RadioGroup11Example },
	{ id: "c-radio-group-12", label: "Avatar Cards", component: RadioGroup12Example },
	{ id: "c-radio-group-13", label: "Payment Methods", component: RadioGroup13Example },
	{ id: "c-radio-group-14", label: "Tooltip Info", component: RadioGroup14Example },
	{ id: "c-radio-group-15", label: "Badges", component: RadioGroup15Example },
	{ id: "c-radio-group-16", label: "Inline Horizontal", component: RadioGroup16Example },
	{ id: "c-radio-group-17", label: "Pricing Tiers", component: RadioGroup17Example },
];

export function RadioGroupExamples(): React.JSX.Element {
	return <ExampleGrid examples={RADIO_GROUP_EXAMPLES} />;
}
