"use client";

// The Tabs examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Tabs1Example } from "@/components/component-gallery/examples/tabs/tabs-1";
import { Tabs2Example } from "@/components/component-gallery/examples/tabs/tabs-2";
import { Tabs3Example } from "@/components/component-gallery/examples/tabs/tabs-3";
import { Tabs4Example } from "@/components/component-gallery/examples/tabs/tabs-4";
import { Tabs5Example } from "@/components/component-gallery/examples/tabs/tabs-5";
import { Tabs6Example } from "@/components/component-gallery/examples/tabs/tabs-6";
import { Tabs7Example } from "@/components/component-gallery/examples/tabs/tabs-7";
import { Tabs8Example } from "@/components/component-gallery/examples/tabs/tabs-8";
import { Tabs9Example } from "@/components/component-gallery/examples/tabs/tabs-9";

export const TABS_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-tabs-1", label: "Basic", component: Tabs1Example },
	{ id: "c-tabs-2", label: "Line Variant", component: Tabs2Example },
	{ id: "c-tabs-3", label: "Vertical", component: Tabs3Example },
	{ id: "c-tabs-4", label: "Vertical Line", component: Tabs4Example },
	{ id: "c-tabs-5", label: "Icons", component: Tabs5Example },
	{ id: "c-tabs-6", label: "Full Width Icons", component: Tabs6Example },
	{ id: "c-tabs-7", label: "Badge Counts", component: Tabs7Example },
	{ id: "c-tabs-8", label: "Side List Icons", component: Tabs8Example },
	{ id: "c-tabs-9", label: "Segmented Control", component: Tabs9Example },
];

export function TabsExamples(): React.JSX.Element {
	return <ExampleGrid examples={TABS_EXAMPLES} />;
}
