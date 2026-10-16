"use client";

// The NumberField examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { NumberField1Example } from "@/components/component-gallery/examples/number-field/number-field-1";
import { NumberField2Example } from "@/components/component-gallery/examples/number-field/number-field-2";
import { NumberField3Example } from "@/components/component-gallery/examples/number-field/number-field-3";
import { NumberField4Example } from "@/components/component-gallery/examples/number-field/number-field-4";
import { NumberField5Example } from "@/components/component-gallery/examples/number-field/number-field-5";
import { NumberField6Example } from "@/components/component-gallery/examples/number-field/number-field-6";

export const NUMBER_FIELD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-number-field-1", label: "Default Size", component: NumberField1Example },
	{ id: "c-number-field-2", label: "Small Size", component: NumberField2Example },
	{ id: "c-number-field-3", label: "Large Size", component: NumberField3Example },
	{ id: "c-number-field-4", label: "Buttons on Right", component: NumberField4Example },
	{ id: "c-number-field-5", label: "Spinner Buttons", component: NumberField5Example },
	{ id: "c-number-field-6", label: "Form Validation", component: NumberField6Example },
];

export function NumberFieldExamples(): React.JSX.Element {
	return <ExampleGrid examples={NUMBER_FIELD_EXAMPLES} />;
}
