"use client";

// The NavigationMenu examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { NavigationMenu1Example } from "@/components/component-gallery/examples/navigation-menu/navigation-menu-1";
import { NavigationMenu2Example } from "@/components/component-gallery/examples/navigation-menu/navigation-menu-2";
import { NavigationMenu3Example } from "@/components/component-gallery/examples/navigation-menu/navigation-menu-3";
import { NavigationMenu4Example } from "@/components/component-gallery/examples/navigation-menu/navigation-menu-4";

export const NAVIGATION_MENU_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-navigation-menu-1", label: "Basic", component: NavigationMenu1Example },
	{ id: "c-navigation-menu-2", label: "Grid Layout", component: NavigationMenu2Example },
	{ id: "c-navigation-menu-3", label: "With Icons", component: NavigationMenu3Example },
	{ id: "c-navigation-menu-4", label: "Learn More Button", component: NavigationMenu4Example },
];

export function NavigationMenuExamples(): React.JSX.Element {
	return <ExampleGrid examples={NAVIGATION_MENU_EXAMPLES} />;
}
