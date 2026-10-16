"use client";

// The Cascader examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Cascader1Example } from "@/components/component-gallery/examples/cascader/cascader-1";
import { Cascader2Example } from "@/components/component-gallery/examples/cascader/cascader-2";
import { Cascader3Example } from "@/components/component-gallery/examples/cascader/cascader-3";
import { Cascader5Example } from "@/components/component-gallery/examples/cascader/cascader-5";
import { Cascader7Example } from "@/components/component-gallery/examples/cascader/cascader-7";
import { Cascader8Example } from "@/components/component-gallery/examples/cascader/cascader-8";
import { Cascader9Example } from "@/components/component-gallery/examples/cascader/cascader-9";
import { Cascader10Example } from "@/components/component-gallery/examples/cascader/cascader-10";
import { Cascader11Example } from "@/components/component-gallery/examples/cascader/cascader-11";
import { Cascader12Example } from "@/components/component-gallery/examples/cascader/cascader-12";
import { Cascader13Example } from "@/components/component-gallery/examples/cascader/cascader-13";
import { Cascader14Example } from "@/components/component-gallery/examples/cascader/cascader-14";
import { Cascader15Example } from "@/components/component-gallery/examples/cascader/cascader-15";
import { Cascader16Example } from "@/components/component-gallery/examples/cascader/cascader-16";
import { Cascader17Example } from "@/components/component-gallery/examples/cascader/cascader-17";
import { Cascader18Example } from "@/components/component-gallery/examples/cascader/cascader-18";
import { Cascader19Example } from "@/components/component-gallery/examples/cascader/cascader-19";
import { Cascader20Example } from "@/components/component-gallery/examples/cascader/cascader-20";
import { Cascader21Example } from "@/components/component-gallery/examples/cascader/cascader-21";
import { Cascader4Example } from "@/components/component-gallery/examples/cascader/cascader-4";
import { Cascader6Example } from "@/components/component-gallery/examples/cascader/cascader-6";

export const CASCADER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-cascader-1", label: "Attribute Picker", component: Cascader1Example },
	{ id: "c-cascader-2", label: "Multi-Select Cap", component: Cascader2Example },
	{ id: "c-cascader-3", label: "Deep Search", component: Cascader3Example },
	{ id: "c-cascader-5", label: "Avatar Rows", component: Cascader5Example },
	{ id: "c-cascader-7", label: "Embedded Panel", component: Cascader7Example },
	{ id: "c-cascader-8", label: "Flat Data", component: Cascader8Example },
	{ id: "c-cascader-9", label: "Controlled State", component: Cascader9Example },
	{ id: "c-cascader-10", label: "Translated Labels", component: Cascader10Example },
	{ id: "c-cascader-11", label: "Two-Line Rows", component: Cascader11Example },
	{ id: "c-cascader-12", label: "Native Form Field", component: Cascader12Example },
	{ id: "c-cascader-13", label: "Columns Mode", component: Cascader13Example },
	{ id: "c-cascader-14", label: "Tree Mode", component: Cascader14Example },
	{ id: "c-cascader-15", label: "Async Loading", component: Cascader15Example },
	{ id: "c-cascader-16", label: "Virtualized List", component: Cascader16Example },
	{ id: "c-cascader-17", label: "Removable Chips", component: Cascader17Example },
	{ id: "c-cascader-18", label: "Tree Multi-Select", component: Cascader18Example },
	{ id: "c-cascader-19", label: "Color Dots", component: Cascader19Example },
	{ id: "c-cascader-20", label: "Inherited Colors", component: Cascader20Example },
	{ id: "c-cascader-21", label: "Global Search", component: Cascader21Example },
	{ id: "c-cascader-4", label: "Footer Flyout", component: Cascader4Example },
	{ id: "c-cascader-6", label: "Path Formatting", component: Cascader6Example },
];

export function CascaderExamples(): React.JSX.Element {
	return <ExampleGrid examples={CASCADER_EXAMPLES} />;
}
