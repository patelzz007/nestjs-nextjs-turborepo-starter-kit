"use client";

// The Sidebar examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Sidebar1Example } from "@/components/component-gallery/examples/sidebar/sidebar-1";
import { Sidebar2Example } from "@/components/component-gallery/examples/sidebar/sidebar-2";
import { Sidebar3Example } from "@/components/component-gallery/examples/sidebar/sidebar-3";
import { Sidebar4Example } from "@/components/component-gallery/examples/sidebar/sidebar-4";
import { Sidebar5Example } from "@/components/component-gallery/examples/sidebar/sidebar-5";

export const SIDEBAR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-sidebar-1", label: "Workspace Switcher", component: Sidebar1Example },
	{ id: "c-sidebar-2", label: "Icon Rail", component: Sidebar2Example },
	{ id: "c-sidebar-3", label: "Docs Navigation", component: Sidebar3Example },
	{ id: "c-sidebar-4", label: "Inspector Panel", component: Sidebar4Example },
	{ id: "c-sidebar-5", label: "Filter & Loading", component: Sidebar5Example },
];

export function SidebarExamples(): React.JSX.Element {
	return <ExampleGrid examples={SIDEBAR_EXAMPLES} />;
}
