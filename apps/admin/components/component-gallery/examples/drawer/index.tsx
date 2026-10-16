"use client";

// The Drawer examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Drawer1Example } from "@/components/component-gallery/examples/drawer/drawer-1";
import { Drawer2Example } from "@/components/component-gallery/examples/drawer/drawer-2";
import { Drawer3Example } from "@/components/component-gallery/examples/drawer/drawer-3";
import { Drawer4Example } from "@/components/component-gallery/examples/drawer/drawer-4";
import { Drawer5Example } from "@/components/component-gallery/examples/drawer/drawer-5";

export const DRAWER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-drawer-1", label: "Scrollable Content", component: Drawer1Example },
	{ id: "c-drawer-2", label: "Right Side", component: Drawer2Example },
	{ id: "c-drawer-3", label: "Left Side", component: Drawer3Example },
	{ id: "c-drawer-4", label: "Top Side", component: Drawer4Example },
	{ id: "c-drawer-5", label: "All Sides", component: Drawer5Example },
];

export function DrawerExamples(): React.JSX.Element {
	return <ExampleGrid examples={DRAWER_EXAMPLES} />;
}
