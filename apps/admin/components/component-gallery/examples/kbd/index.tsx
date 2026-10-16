"use client";

// The Kbd examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Kbd1Example } from "@/components/component-gallery/examples/kbd/kbd-1";
import { Kbd2Example } from "@/components/component-gallery/examples/kbd/kbd-2";
import { Kbd3Example } from "@/components/component-gallery/examples/kbd/kbd-3";
import { Kbd4Example } from "@/components/component-gallery/examples/kbd/kbd-4";
import { Kbd5Example } from "@/components/component-gallery/examples/kbd/kbd-5";
import { Kbd6Example } from "@/components/component-gallery/examples/kbd/kbd-6";

export const KBD_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-kbd-1", label: "Basic Keys", component: Kbd1Example },
	{ id: "c-kbd-2", label: "Grouped Keys", component: Kbd2Example },
	{ id: "c-kbd-3", label: "Keys With Icons", component: Kbd3Example },
	{ id: "c-kbd-4", label: "In Input", component: Kbd4Example },
	{ id: "c-kbd-5", label: "In Tooltip", component: Kbd5Example },
	{ id: "c-kbd-6", label: "Shortcut List", component: Kbd6Example },
];

export function KbdExamples(): React.JSX.Element {
	return <ExampleGrid examples={KBD_EXAMPLES} />;
}
