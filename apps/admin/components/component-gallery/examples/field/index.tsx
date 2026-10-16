"use client";

// The Field examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Field1Example } from "@/components/component-gallery/examples/field/field-1";
import { Field2Example } from "@/components/component-gallery/examples/field/field-2";
import { Field3Example } from "@/components/component-gallery/examples/field/field-3";
import { Field4Example } from "@/components/component-gallery/examples/field/field-4";
import { Field5Example } from "@/components/component-gallery/examples/field/field-5";
import { Field6Example } from "@/components/component-gallery/examples/field/field-6";
import { Field7Example } from "@/components/component-gallery/examples/field/field-7";
import { Field8Example } from "@/components/component-gallery/examples/field/field-8";
import { Field9Example } from "@/components/component-gallery/examples/field/field-9";
import { Field10Example } from "@/components/component-gallery/examples/field/field-10";
import { Field11Example } from "@/components/component-gallery/examples/field/field-11";

export const FIELD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-field-1", label: "Input Groups", component: Field1Example },
	{ id: "c-field-2", label: "Input & Textarea", component: Field2Example },
	{ id: "c-field-3", label: "Select Controls", component: Field3Example },
	{ id: "c-field-4", label: "Radio & Checkboxes", component: Field4Example },
	{ id: "c-field-5", label: "Slider & Switch", component: Field5Example },
	{ id: "c-field-6", label: "OTP Input", component: Field6Example },
	{ id: "c-field-7", label: "Settings Form", component: Field7Example },
	{ id: "c-field-8", label: "Permissions", component: Field8Example },
	{ id: "c-field-9", label: "Responsive Layout", component: Field9Example },
	{ id: "c-field-10", label: "Notification Preferences", component: Field10Example },
	{ id: "c-field-11", label: "Validation Errors", component: Field11Example },
];

export function FieldExamples(): React.JSX.Element {
	return <ExampleGrid examples={FIELD_EXAMPLES} />;
}
