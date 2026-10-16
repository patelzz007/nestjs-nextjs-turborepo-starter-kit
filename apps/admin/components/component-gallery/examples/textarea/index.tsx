"use client";

// The Textarea examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Textarea1Example } from "@/components/component-gallery/examples/textarea/textarea-1";
import { Textarea2Example } from "@/components/component-gallery/examples/textarea/textarea-2";
import { Textarea3Example } from "@/components/component-gallery/examples/textarea/textarea-3";
import { Textarea4Example } from "@/components/component-gallery/examples/textarea/textarea-4";
import { Textarea5Example } from "@/components/component-gallery/examples/textarea/textarea-5";
import { Textarea6Example } from "@/components/component-gallery/examples/textarea/textarea-6";

export const TEXTAREA_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-textarea-1", label: "Basic", component: Textarea1Example },
	{ id: "c-textarea-2", label: "Invalid", component: Textarea2Example },
	{ id: "c-textarea-3", label: "With Label", component: Textarea3Example },
	{ id: "c-textarea-4", label: "With Description", component: Textarea4Example },
	{ id: "c-textarea-5", label: "Disabled", component: Textarea5Example },
	{ id: "c-textarea-6", label: "Auto-Resize Counter", component: Textarea6Example },
];

export function TextareaExamples(): React.JSX.Element {
	return <ExampleGrid examples={TEXTAREA_EXAMPLES} />;
}
