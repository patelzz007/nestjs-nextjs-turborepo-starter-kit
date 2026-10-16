"use client";

// The Dialog examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Dialog1Example } from "@/components/component-gallery/examples/dialog/dialog-1";
import { Dialog2Example } from "@/components/component-gallery/examples/dialog/dialog-2";
import { Dialog3Example } from "@/components/component-gallery/examples/dialog/dialog-3";
import { Dialog4Example } from "@/components/component-gallery/examples/dialog/dialog-4";
import { Dialog5Example } from "@/components/component-gallery/examples/dialog/dialog-5";
import { Dialog6Example } from "@/components/component-gallery/examples/dialog/dialog-6";
import { Dialog7Example } from "@/components/component-gallery/examples/dialog/dialog-7";
import { Dialog8Example } from "@/components/component-gallery/examples/dialog/dialog-8";
import { Dialog9Example } from "@/components/component-gallery/examples/dialog/dialog-9";
import { Dialog10Example } from "@/components/component-gallery/examples/dialog/dialog-10";

export const DIALOG_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-dialog-1", label: "Basic", component: Dialog1Example },
	{ id: "c-dialog-2", label: "Scrollable Content", component: Dialog2Example },
	{ id: "c-dialog-3", label: "Sticky Footer", component: Dialog3Example },
	{ id: "c-dialog-4", label: "No Close Button", component: Dialog4Example },
	{ id: "c-dialog-5", label: "Custom Close Button", component: Dialog5Example },
	{ id: "c-dialog-6", label: "Full-Screen", component: Dialog6Example },
	{ id: "c-dialog-7", label: "Destructive Confirmation", component: Dialog7Example },
	{ id: "c-dialog-8", label: "Cookie Consent", component: Dialog8Example },
	{ id: "c-dialog-9", label: "Keyboard Shortcuts", component: Dialog9Example },
	{ id: "c-dialog-10", label: "Full Width Button", component: Dialog10Example },
];

export function DialogExamples(): React.JSX.Element {
	return <ExampleGrid examples={DIALOG_EXAMPLES} />;
}
