"use client";

// The Menubar examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Menubar1Example } from "@/components/component-gallery/examples/menubar/menubar-1";
import { Menubar2Example } from "@/components/component-gallery/examples/menubar/menubar-2";
import { Menubar3Example } from "@/components/component-gallery/examples/menubar/menubar-3";
import { Menubar4Example } from "@/components/component-gallery/examples/menubar/menubar-4";
import { Menubar5Example } from "@/components/component-gallery/examples/menubar/menubar-5";

export const MENUBAR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-menubar-1", label: "Basic", component: Menubar1Example },
	{ id: "c-menubar-2", label: "Submenus", component: Menubar2Example },
	{ id: "c-menubar-3", label: "Checkbox & Radio", component: Menubar3Example },
	{ id: "c-menubar-4", label: "Icons", component: Menubar4Example },
	{ id: "c-menubar-5", label: "Formatting & Media", component: Menubar5Example },
];

export function MenubarExamples(): React.JSX.Element {
	return <ExampleGrid examples={MENUBAR_EXAMPLES} />;
}
