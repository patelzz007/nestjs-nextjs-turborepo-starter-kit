"use client";

// The PhoneInput examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { PhoneInput1Example } from "@/components/component-gallery/examples/phone-input/phone-input-1";
import { PhoneInput2Example } from "@/components/component-gallery/examples/phone-input/phone-input-2";
import { PhoneInput3Example } from "@/components/component-gallery/examples/phone-input/phone-input-3";
import { PhoneInput4Example } from "@/components/component-gallery/examples/phone-input/phone-input-4";
import { PhoneInput5Example } from "@/components/component-gallery/examples/phone-input/phone-input-5";
import { PhoneInput6Example } from "@/components/component-gallery/examples/phone-input/phone-input-6";
import { PhoneInput7Example } from "@/components/component-gallery/examples/phone-input/phone-input-7";
import { PhoneInput8Example } from "@/components/component-gallery/examples/phone-input/phone-input-8";

export const PHONE_INPUT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-phone-input-1", label: "Basic", component: PhoneInput1Example },
	{ id: "c-phone-input-2", label: "Small", component: PhoneInput2Example },
	{ id: "c-phone-input-3", label: "Large", component: PhoneInput3Example },
	{ id: "c-phone-input-4", label: "Disabled", component: PhoneInput4Example },
	{ id: "c-phone-input-5", label: "Preset Value", component: PhoneInput5Example },
	{ id: "c-phone-input-6", label: "Error State", component: PhoneInput6Example },
	{ id: "c-phone-input-7", label: "Default Country", component: PhoneInput7Example },
	{ id: "c-phone-input-8", label: "Read-Only", component: PhoneInput8Example },
];

export function PhoneInputExamples(): React.JSX.Element {
	return <ExampleGrid examples={PHONE_INPUT_EXAMPLES} />;
}
