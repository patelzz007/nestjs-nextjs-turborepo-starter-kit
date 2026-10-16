"use client";

// The ContextMenu examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { ContextMenu1Example } from "@/components/component-gallery/examples/context-menu/context-menu-1";
import { ContextMenu2Example } from "@/components/component-gallery/examples/context-menu/context-menu-2";
import { ContextMenu3Example } from "@/components/component-gallery/examples/context-menu/context-menu-3";
import { ContextMenu4Example } from "@/components/component-gallery/examples/context-menu/context-menu-4";
import { ContextMenu5Example } from "@/components/component-gallery/examples/context-menu/context-menu-5";
import { ContextMenu6Example } from "@/components/component-gallery/examples/context-menu/context-menu-6";
import { ContextMenu7Example } from "@/components/component-gallery/examples/context-menu/context-menu-7";
import { ContextMenu8Example } from "@/components/component-gallery/examples/context-menu/context-menu-8";
import { ContextMenu9Example } from "@/components/component-gallery/examples/context-menu/context-menu-9";
import { ContextMenu10Example } from "@/components/component-gallery/examples/context-menu/context-menu-10";

export const CONTEXT_MENU_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-context-menu-1", label: "Basic", component: ContextMenu1Example },
	{ id: "c-context-menu-2", label: "Icons", component: ContextMenu2Example },
	{ id: "c-context-menu-3", label: "Shortcuts", component: ContextMenu3Example },
	{ id: "c-context-menu-4", label: "Nested Submenus", component: ContextMenu4Example },
	{ id: "c-context-menu-5", label: "Labels & Separators", component: ContextMenu5Example },
	{ id: "c-context-menu-6", label: "Checkbox Items", component: ContextMenu6Example },
	{ id: "c-context-menu-7", label: "Radio Items", component: ContextMenu7Example },
	{ id: "c-context-menu-8", label: "Destructive Actions", component: ContextMenu8Example },
	{ id: "c-context-menu-9", label: "Alignment Sides", component: ContextMenu9Example },
	{ id: "c-context-menu-10", label: "Inside Dialog", component: ContextMenu10Example },
];

export function ContextMenuExamples(): React.JSX.Element {
	return <ExampleGrid examples={CONTEXT_MENU_EXAMPLES} />;
}
