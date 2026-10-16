"use client";

// The Item examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Item1Example } from "@/components/component-gallery/examples/item/item-1";
import { Item2Example } from "@/components/component-gallery/examples/item/item-2";
import { Item3Example } from "@/components/component-gallery/examples/item/item-3";
import { Item4Example } from "@/components/component-gallery/examples/item/item-4";
import { Item5Example } from "@/components/component-gallery/examples/item/item-5";
import { Item6Example } from "@/components/component-gallery/examples/item/item-6";
import { Item7Example } from "@/components/component-gallery/examples/item/item-7";
import { Item8Example } from "@/components/component-gallery/examples/item/item-8";
import { Item9Example } from "@/components/component-gallery/examples/item/item-9";
import { Item10Example } from "@/components/component-gallery/examples/item/item-10";
import { Item11Example } from "@/components/component-gallery/examples/item/item-11";
import { Item12Example } from "@/components/component-gallery/examples/item/item-12";

export const ITEM_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-item-1", label: "Variants", component: Item1Example },
	{ id: "c-item-2", label: "Icon & Actions", component: Item2Example },
	{ id: "c-item-3", label: "User Follow", component: Item3Example },
	{ id: "c-item-4", label: "Navigation Links", component: Item4Example },
	{ id: "c-item-5", label: "Status Badges", component: Item5Example },
	{ id: "c-item-6", label: "File Rows", component: Item6Example },
	{ id: "c-item-7", label: "Keyboard Shortcuts", component: Item7Example },
	{ id: "c-item-8", label: "Small Count Badges", component: Item8Example },
	{ id: "c-item-9", label: "Team Roles", component: Item9Example },
	{ id: "c-item-10", label: "Header & Footer", component: Item10Example },
	{ id: "c-item-11", label: "Integrations", component: Item11Example },
	{ id: "c-item-12", label: "Activity Feed", component: Item12Example },
];

export function ItemExamples(): React.JSX.Element {
	return <ExampleGrid examples={ITEM_EXAMPLES} />;
}
