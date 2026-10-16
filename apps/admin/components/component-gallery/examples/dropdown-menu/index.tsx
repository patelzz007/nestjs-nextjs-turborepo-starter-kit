"use client";

// The DropdownMenu examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { DropdownMenu1Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-1";
import { DropdownMenu2Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-2";
import { DropdownMenu3Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-3";
import { DropdownMenu4Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-4";
import { DropdownMenu5Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-5";
import { DropdownMenu6Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-6";
import { DropdownMenu7Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-7";
import { DropdownMenu8Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-8";
import { DropdownMenu9Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-9";
import { DropdownMenu11Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-11";
import { DropdownMenu12Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-12";
import { DropdownMenu13Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-13";
import { DropdownMenu14Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-14";
import { DropdownMenu15Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-15";
import { DropdownMenu16Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-16";
import { DropdownMenu17Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-17";
import { DropdownMenu10Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-10";
import { DropdownMenu18Example } from "@/components/component-gallery/examples/dropdown-menu/dropdown-menu-18";

export const DROPDOWN_MENU_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-dropdown-menu-1", label: "Basic", component: DropdownMenu1Example },
	{ id: "c-dropdown-menu-2", label: "Opening Positions", component: DropdownMenu2Example },
	{ id: "c-dropdown-menu-3", label: "Icons", component: DropdownMenu3Example },
	{ id: "c-dropdown-menu-4", label: "Keyboard Shortcuts", component: DropdownMenu4Example },
	{ id: "c-dropdown-menu-5", label: "Nested Submenus", component: DropdownMenu5Example },
	{ id: "c-dropdown-menu-6", label: "Checkboxes", component: DropdownMenu6Example },
	{ id: "c-dropdown-menu-7", label: "Radio Groups", component: DropdownMenu7Example },
	{ id: "c-dropdown-menu-8", label: "All Item Types", component: DropdownMenu8Example },
	{ id: "c-dropdown-menu-9", label: "User Profile", component: DropdownMenu9Example },
	{ id: "c-dropdown-menu-11", label: "Notification Feed", component: DropdownMenu11Example },
	{ id: "c-dropdown-menu-12", label: "Record Actions", component: DropdownMenu12Example },
	{ id: "c-dropdown-menu-13", label: "Share & Export", component: DropdownMenu13Example },
	{ id: "c-dropdown-menu-14", label: "Theme & Status", component: DropdownMenu14Example },
	{ id: "c-dropdown-menu-15", label: "User & Create", component: DropdownMenu15Example },
	{ id: "c-dropdown-menu-16", label: "Quick Actions", component: DropdownMenu16Example },
	{ id: "c-dropdown-menu-17", label: "Notification Items", component: DropdownMenu17Example },
	{ id: "c-dropdown-menu-10", label: "Workspace Switcher", component: DropdownMenu10Example },
	{ id: "c-dropdown-menu-18", label: "AI Model Selector", component: DropdownMenu18Example },
];

export function DropdownMenuExamples(): React.JSX.Element {
	return <ExampleGrid examples={DROPDOWN_MENU_EXAMPLES} />;
}
