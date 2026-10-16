"use client";

// The Accordion examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Accordion1Example } from "@/components/component-gallery/examples/accordion/accordion-1";
import { Accordion2Example } from "@/components/component-gallery/examples/accordion/accordion-2";
import { Accordion3Example } from "@/components/component-gallery/examples/accordion/accordion-3";
import { Accordion4Example } from "@/components/component-gallery/examples/accordion/accordion-4";
import { Accordion5Example } from "@/components/component-gallery/examples/accordion/accordion-5";
import { Accordion6Example } from "@/components/component-gallery/examples/accordion/accordion-6";
import { Accordion7Example } from "@/components/component-gallery/examples/accordion/accordion-7";
import { Accordion8Example } from "@/components/component-gallery/examples/accordion/accordion-8";
import { Accordion9Example } from "@/components/component-gallery/examples/accordion/accordion-9";
import { Accordion10Example } from "@/components/component-gallery/examples/accordion/accordion-10";
import { Accordion11Example } from "@/components/component-gallery/examples/accordion/accordion-11";

export const ACCORDION_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-accordion-1", label: "Single Expand", component: Accordion1Example },
	{ id: "c-accordion-2", label: "Plus Minus Icons", component: Accordion2Example },
	{ id: "c-accordion-3", label: "Bordered Rounded", component: Accordion3Example },
	{ id: "c-accordion-4", label: "In Card", component: Accordion4Example },
	{ id: "c-accordion-5", label: "Disabled Items", component: Accordion5Example },
	{ id: "c-accordion-6", label: "Icons & Badges", component: Accordion6Example },
	{ id: "c-accordion-7", label: "In Frame", component: Accordion7Example },
	{ id: "c-accordion-8", label: "Nested", component: Accordion8Example },
	{ id: "c-accordion-9", label: "User List", component: Accordion9Example },
	{ id: "c-accordion-10", label: "Rotating Arrow", component: Accordion10Example },
	{ id: "c-accordion-11", label: "Setup Steps", component: Accordion11Example },
];

export function AccordionExamples(): React.JSX.Element {
	return <ExampleGrid examples={ACCORDION_EXAMPLES} />;
}
