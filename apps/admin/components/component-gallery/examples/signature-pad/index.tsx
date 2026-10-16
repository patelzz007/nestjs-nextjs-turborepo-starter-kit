"use client";

// The SignaturePad examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { SignaturePad1Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-1";
import { SignaturePad2Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-2";
import { SignaturePad3Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-3";
import { SignaturePad4Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-4";
import { SignaturePad5Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-5";
import { SignaturePad6Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-6";
import { SignaturePad7Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-7";
import { SignaturePad8Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-8";
import { SignaturePad9Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-9";
import { SignaturePad10Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-10";
import { SignaturePad11Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-11";
import { SignaturePad12Example } from "@/components/component-gallery/examples/signature-pad/signature-pad-12";

export const SIGNATURE_PAD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-signature-pad-1", label: "Pinned Actions", component: SignaturePad1Example },
	{ id: "c-signature-pad-2", label: "Undo & Redo", component: SignaturePad2Example },
	{ id: "c-signature-pad-3", label: "Form Validation", component: SignaturePad3Example },
	{ id: "c-signature-pad-4", label: "Signing Workspace", component: SignaturePad4Example },
	{ id: "c-signature-pad-5", label: "Export Formats", component: SignaturePad5Example },
	{ id: "c-signature-pad-6", label: "Draw or Type", component: SignaturePad6Example },
	{ id: "c-signature-pad-7", label: "Agreement Card", component: SignaturePad7Example },
	{ id: "c-signature-pad-8", label: "In Dialog", component: SignaturePad8Example },
	{ id: "c-signature-pad-9", label: "Stylus Mode", component: SignaturePad9Example },
	{ id: "c-signature-pad-10", label: "Clause Initials", component: SignaturePad10Example },
	{ id: "c-signature-pad-11", label: "Proof of Delivery", component: SignaturePad11Example },
	{ id: "c-signature-pad-12", label: "File Upload", component: SignaturePad12Example },
];

export function SignaturePadExamples(): React.JSX.Element {
	return <ExampleGrid examples={SIGNATURE_PAD_EXAMPLES} />;
}
