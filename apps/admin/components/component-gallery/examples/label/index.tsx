"use client";

// The Label examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Label1Example } from "@/components/component-gallery/examples/label/label-1";
import { Label2Example } from "@/components/component-gallery/examples/label/label-2";
import { Label3Example } from "@/components/component-gallery/examples/label/label-3";
import { Label4Example } from "@/components/component-gallery/examples/label/label-4";
import { Label5Example } from "@/components/component-gallery/examples/label/label-5";
import { Label6Example } from "@/components/component-gallery/examples/label/label-6";
import { Label7Example } from "@/components/component-gallery/examples/label/label-7";
import { Label8Example } from "@/components/component-gallery/examples/label/label-8";
import { Label9Example } from "@/components/component-gallery/examples/label/label-9";
import { Label10Example } from "@/components/component-gallery/examples/label/label-10";
import { Label11Example } from "@/components/component-gallery/examples/label/label-11";
import { Label12Example } from "@/components/component-gallery/examples/label/label-12";
import { Label13Example } from "@/components/component-gallery/examples/label/label-13";

export const LABEL_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-label-1", label: "Basic", component: Label1Example },
	{ id: "c-label-2", label: "Checkbox", component: Label2Example },
	{ id: "c-label-3", label: "Textarea", component: Label3Example },
	{ id: "c-label-4", label: "Disabled", component: Label4Example },
	{ id: "c-label-5", label: "Required", component: Label5Example },
	{ id: "c-label-6", label: "Optional", component: Label6Example },
	{ id: "c-label-7", label: "Tooltip Info", component: Label7Example },
	{ id: "c-label-8", label: "Badge", component: Label8Example },
	{ id: "c-label-9", label: "Character Counter", component: Label9Example },
	{ id: "c-label-10", label: "Helper Text", component: Label10Example },
	{ id: "c-label-11", label: "Error State", component: Label11Example },
	{ id: "c-label-12", label: "Inline Edit", component: Label12Example },
	{ id: "c-label-13", label: "Status Dot", component: Label13Example },
];

export function LabelExamples(): React.JSX.Element {
	return <ExampleGrid examples={LABEL_EXAMPLES} />;
}
