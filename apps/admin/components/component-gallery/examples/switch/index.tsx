"use client";

// The Switch examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Switch1Example } from "@/components/component-gallery/examples/switch/switch-1";
import { Switch2Example } from "@/components/component-gallery/examples/switch/switch-2";
import { Switch3Example } from "@/components/component-gallery/examples/switch/switch-3";
import { Switch4Example } from "@/components/component-gallery/examples/switch/switch-4";
import { Switch5Example } from "@/components/component-gallery/examples/switch/switch-5";
import { Switch6Example } from "@/components/component-gallery/examples/switch/switch-6";
import { Switch7Example } from "@/components/component-gallery/examples/switch/switch-7";
import { Switch8Example } from "@/components/component-gallery/examples/switch/switch-8";
import { Switch9Example } from "@/components/component-gallery/examples/switch/switch-9";
import { Switch10Example } from "@/components/component-gallery/examples/switch/switch-10";
import { Switch11Example } from "@/components/component-gallery/examples/switch/switch-11";
import { Switch12Example } from "@/components/component-gallery/examples/switch/switch-12";
import { Switch13Example } from "@/components/component-gallery/examples/switch/switch-13";
import { Switch14Example } from "@/components/component-gallery/examples/switch/switch-14";

export const SWITCH_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-switch-1", label: "Basic", component: Switch1Example },
	{ id: "c-switch-2", label: "With Description", component: Switch2Example },
	{ id: "c-switch-3", label: "Disabled", component: Switch3Example },
	{ id: "c-switch-4", label: "Sizes", component: Switch4Example },
	{ id: "c-switch-5", label: "Switch Group", component: Switch5Example },
	{ id: "c-switch-6", label: "Card Separators", component: Switch6Example },
	{ id: "c-switch-7", label: "Card With Icons", component: Switch7Example },
	{ id: "c-switch-8", label: "In Frame", component: Switch8Example },
	{ id: "c-switch-9", label: "Tooltip Info", component: Switch9Example },
	{ id: "c-switch-10", label: "With Badges", component: Switch10Example },
	{ id: "c-switch-11", label: "Colored", component: Switch11Example },
	{ id: "c-switch-12", label: "Destructive Confirm", component: Switch12Example },
	{ id: "c-switch-13", label: "Compact Table", component: Switch13Example },
	{ id: "c-switch-14", label: "Card Grid", component: Switch14Example },
];

export function SwitchExamples(): React.JSX.Element {
	return <ExampleGrid examples={SWITCH_EXAMPLES} />;
}
