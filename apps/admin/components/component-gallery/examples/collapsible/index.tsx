"use client";

// The Collapsible examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Collapsible1Example } from "@/components/component-gallery/examples/collapsible/collapsible-1";
import { Collapsible2Example } from "@/components/component-gallery/examples/collapsible/collapsible-2";
import { Collapsible3Example } from "@/components/component-gallery/examples/collapsible/collapsible-3";
import { Collapsible4Example } from "@/components/component-gallery/examples/collapsible/collapsible-4";
import { Collapsible5Example } from "@/components/component-gallery/examples/collapsible/collapsible-5";
import { Collapsible6Example } from "@/components/component-gallery/examples/collapsible/collapsible-6";
import { Collapsible7Example } from "@/components/component-gallery/examples/collapsible/collapsible-7";
import { Collapsible8Example } from "@/components/component-gallery/examples/collapsible/collapsible-8";
import { Collapsible9Example } from "@/components/component-gallery/examples/collapsible/collapsible-9";
import { Collapsible10Example } from "@/components/component-gallery/examples/collapsible/collapsible-10";

export const COLLAPSIBLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-collapsible-1", label: "Basic", component: Collapsible1Example },
	{ id: "c-collapsible-2", label: "Checkbox Settings", component: Collapsible2Example },
	{ id: "c-collapsible-3", label: "Animated Card", component: Collapsible3Example },
	{ id: "c-collapsible-4", label: "Bottom Trigger", component: Collapsible4Example },
	{ id: "c-collapsible-5", label: "Form Fields", component: Collapsible5Example },
	{ id: "c-collapsible-6", label: "In Frame", component: Collapsible6Example },
	{ id: "c-collapsible-7", label: "Nested List", component: Collapsible7Example },
	{ id: "c-collapsible-8", label: "User Profile", component: Collapsible8Example },
	{ id: "c-collapsible-9", label: "Multi-Level Menu", component: Collapsible9Example },
	{ id: "c-collapsible-10", label: "File Tree", component: Collapsible10Example },
];

export function CollapsibleExamples(): React.JSX.Element {
	return <ExampleGrid examples={COLLAPSIBLE_EXAMPLES} />;
}
