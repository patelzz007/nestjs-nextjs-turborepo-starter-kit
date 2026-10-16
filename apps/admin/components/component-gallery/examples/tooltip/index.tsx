"use client";

// The Tooltip examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Tooltip1Example } from "@/components/component-gallery/examples/tooltip/tooltip-1";
import { Tooltip2Example } from "@/components/component-gallery/examples/tooltip/tooltip-2";
import { Tooltip3Example } from "@/components/component-gallery/examples/tooltip/tooltip-3";
import { Tooltip4Example } from "@/components/component-gallery/examples/tooltip/tooltip-4";
import { Tooltip5Example } from "@/components/component-gallery/examples/tooltip/tooltip-5";
import { Tooltip6Example } from "@/components/component-gallery/examples/tooltip/tooltip-6";
import { Tooltip7Example } from "@/components/component-gallery/examples/tooltip/tooltip-7";
import { Tooltip8Example } from "@/components/component-gallery/examples/tooltip/tooltip-8";
import { Tooltip9Example } from "@/components/component-gallery/examples/tooltip/tooltip-9";
import { Tooltip10Example } from "@/components/component-gallery/examples/tooltip/tooltip-10";
import { Tooltip11Example } from "@/components/component-gallery/examples/tooltip/tooltip-11";
import { Tooltip12Example } from "@/components/component-gallery/examples/tooltip/tooltip-12";
import { Tooltip13Example } from "@/components/component-gallery/examples/tooltip/tooltip-13";
import { Tooltip14Example } from "@/components/component-gallery/examples/tooltip/tooltip-14";
import { Tooltip15Example } from "@/components/component-gallery/examples/tooltip/tooltip-15";
import { Tooltip16Example } from "@/components/component-gallery/examples/tooltip/tooltip-16";

export const TOOLTIP_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-tooltip-1", label: "Basic", component: Tooltip1Example },
	{ id: "c-tooltip-2", label: "Placements", component: Tooltip2Example },
	{ id: "c-tooltip-3", label: "Icon Trigger", component: Tooltip3Example },
	{ id: "c-tooltip-4", label: "Keyboard Shortcut", component: Tooltip4Example },
	{ id: "c-tooltip-5", label: "Bell With Count", component: Tooltip5Example },
	{ id: "c-tooltip-6", label: "Status Badges", component: Tooltip6Example },
	{ id: "c-tooltip-7", label: "Verified Domain", component: Tooltip7Example },
	{ id: "c-tooltip-8", label: "Toolbar Actions", component: Tooltip8Example },
	{ id: "c-tooltip-9", label: "Warning", component: Tooltip9Example },
	{ id: "c-tooltip-10", label: "Upgrade Prompt", component: Tooltip10Example },
	{ id: "c-tooltip-11", label: "Avatar Role Badge", component: Tooltip11Example },
	{ id: "c-tooltip-12", label: "Disabled Button", component: Tooltip12Example },
	{ id: "c-tooltip-13", label: "Online Status", component: Tooltip13Example },
	{ id: "c-tooltip-14", label: "File Info", component: Tooltip14Example },
	{ id: "c-tooltip-15", label: "Label Badges", component: Tooltip15Example },
	{ id: "c-tooltip-16", label: "Unread Bell", component: Tooltip16Example },
];

export function TooltipExamples(): React.JSX.Element {
	return <ExampleGrid examples={TOOLTIP_EXAMPLES} />;
}
