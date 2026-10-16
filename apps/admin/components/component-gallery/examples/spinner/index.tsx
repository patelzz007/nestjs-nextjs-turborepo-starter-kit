"use client";

// The Spinner examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Spinner1Example } from "@/components/component-gallery/examples/spinner/spinner-1";
import { Spinner2Example } from "@/components/component-gallery/examples/spinner/spinner-2";
import { Spinner3Example } from "@/components/component-gallery/examples/spinner/spinner-3";
import { Spinner4Example } from "@/components/component-gallery/examples/spinner/spinner-4";
import { Spinner5Example } from "@/components/component-gallery/examples/spinner/spinner-5";
import { Spinner6Example } from "@/components/component-gallery/examples/spinner/spinner-6";
import { Spinner7Example } from "@/components/component-gallery/examples/spinner/spinner-7";
import { Spinner8Example } from "@/components/component-gallery/examples/spinner/spinner-8";
import { Spinner9Example } from "@/components/component-gallery/examples/spinner/spinner-9";
import { Spinner10Example } from "@/components/component-gallery/examples/spinner/spinner-10";
import { Spinner11Example } from "@/components/component-gallery/examples/spinner/spinner-11";
import { Spinner12Example } from "@/components/component-gallery/examples/spinner/spinner-12";

export const SPINNER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-spinner-1", label: "Basic", component: Spinner1Example },
	{ id: "c-spinner-2", label: "In Buttons", component: Spinner2Example },
	{ id: "c-spinner-3", label: "In Badges", component: Spinner3Example },
	{ id: "c-spinner-4", label: "In Input Group", component: Spinner4Example },
	{ id: "c-spinner-5", label: "In Empty State", component: Spinner5Example },
	{ id: "c-spinner-6", label: "Pending Buttons", component: Spinner6Example },
	{ id: "c-spinner-7", label: "Overlay With Caption", component: Spinner7Example },
	{ id: "c-spinner-8", label: "Full Page", component: Spinner8Example },
	{ id: "c-spinner-9", label: "Inline Text", component: Spinner9Example },
	{ id: "c-spinner-10", label: "Loading Dots", component: Spinner10Example },
	{ id: "c-spinner-11", label: "Card Overlay", component: Spinner11Example },
	{ id: "c-spinner-12", label: "Color Variants", component: Spinner12Example },
];

export function SpinnerExamples(): React.JSX.Element {
	return <ExampleGrid examples={SPINNER_EXAMPLES} />;
}
