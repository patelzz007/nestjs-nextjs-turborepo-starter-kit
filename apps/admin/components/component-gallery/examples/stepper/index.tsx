"use client";

// The Stepper examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Stepper1Example } from "@/components/component-gallery/examples/stepper/stepper-1";
import { Stepper2Example } from "@/components/component-gallery/examples/stepper/stepper-2";
import { Stepper3Example } from "@/components/component-gallery/examples/stepper/stepper-3";
import { Stepper4Example } from "@/components/component-gallery/examples/stepper/stepper-4";
import { Stepper5Example } from "@/components/component-gallery/examples/stepper/stepper-5";
import { Stepper6Example } from "@/components/component-gallery/examples/stepper/stepper-6";
import { Stepper7Example } from "@/components/component-gallery/examples/stepper/stepper-7";
import { Stepper8Example } from "@/components/component-gallery/examples/stepper/stepper-8";
import { Stepper9Example } from "@/components/component-gallery/examples/stepper/stepper-9";
import { Stepper10Example } from "@/components/component-gallery/examples/stepper/stepper-10";
import { Stepper11Example } from "@/components/component-gallery/examples/stepper/stepper-11";
import { Stepper12Example } from "@/components/component-gallery/examples/stepper/stepper-12";
import { Stepper13Example } from "@/components/component-gallery/examples/stepper/stepper-13";
import { Stepper14Example } from "@/components/component-gallery/examples/stepper/stepper-14";
import { Stepper15Example } from "@/components/component-gallery/examples/stepper/stepper-15";
import { Stepper16Example } from "@/components/component-gallery/examples/stepper/stepper-16";
import { Stepper17Example } from "@/components/component-gallery/examples/stepper/stepper-17";
import { Stepper18Example } from "@/components/component-gallery/examples/stepper/stepper-18";
import { Stepper19Example } from "@/components/component-gallery/examples/stepper/stepper-19";
import { Stepper20Example } from "@/components/component-gallery/examples/stepper/stepper-20";
import { Stepper21Example } from "@/components/component-gallery/examples/stepper/stepper-21";
import { Stepper22Example } from "@/components/component-gallery/examples/stepper/stepper-22";
import { Stepper23Example } from "@/components/component-gallery/examples/stepper/stepper-23";
import { Stepper24Example } from "@/components/component-gallery/examples/stepper/stepper-24";
import { Stepper25Example } from "@/components/component-gallery/examples/stepper/stepper-25";
import { Stepper26Example } from "@/components/component-gallery/examples/stepper/stepper-26";
import { Stepper27Example } from "@/components/component-gallery/examples/stepper/stepper-27";
import { Stepper28Example } from "@/components/component-gallery/examples/stepper/stepper-28";
import { Stepper29Example } from "@/components/component-gallery/examples/stepper/stepper-29";
import { Stepper30Example } from "@/components/component-gallery/examples/stepper/stepper-30";
import { Stepper31Example } from "@/components/component-gallery/examples/stepper/stepper-31";
import { Stepper32Example } from "@/components/component-gallery/examples/stepper/stepper-32";
import { Stepper33Example } from "@/components/component-gallery/examples/stepper/stepper-33";
import { Stepper34Example } from "@/components/component-gallery/examples/stepper/stepper-34";
import { Stepper35Example } from "@/components/component-gallery/examples/stepper/stepper-35";
import { Stepper36Example } from "@/components/component-gallery/examples/stepper/stepper-36";
import { Stepper37Example } from "@/components/component-gallery/examples/stepper/stepper-37";
import { Stepper38Example } from "@/components/component-gallery/examples/stepper/stepper-38";
import { Stepper39Example } from "@/components/component-gallery/examples/stepper/stepper-39";
import { Stepper40Example } from "@/components/component-gallery/examples/stepper/stepper-40";
import { Stepper41Example } from "@/components/component-gallery/examples/stepper/stepper-41";
import { Stepper42Example } from "@/components/component-gallery/examples/stepper/stepper-42";
import { Stepper43Example } from "@/components/component-gallery/examples/stepper/stepper-43";
import { Stepper44Example } from "@/components/component-gallery/examples/stepper/stepper-44";

export const STEPPER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-stepper-1", label: "Basic", component: Stepper1Example },
	{ id: "c-stepper-2", label: "Completed State", component: Stepper2Example },
	{ id: "c-stepper-3", label: "Loading State", component: Stepper3Example },
	{ id: "c-stepper-4", label: "Controlled", component: Stepper4Example },
	{ id: "c-stepper-5", label: "Labels Below", component: Stepper5Example },
	{ id: "c-stepper-6", label: "Left Aligned Titles", component: Stepper6Example },
	{ id: "c-stepper-7", label: "Icons & Badges", component: Stepper7Example },
	{ id: "c-stepper-8", label: "Descriptions", component: Stepper8Example },
	{ id: "c-stepper-9", label: "Inline Titles", component: Stepper9Example },
	{ id: "c-stepper-10", label: "Title & Caption", component: Stepper10Example },
	{ id: "c-stepper-11", label: "Bar With Titles", component: Stepper11Example },
	{ id: "c-stepper-12", label: "Segmented Bar", component: Stepper12Example },
	{ id: "c-stepper-13", label: "Vertical Descriptions", component: Stepper13Example },
	{ id: "c-stepper-14", label: "Vertical", component: Stepper14Example },
	{ id: "c-stepper-15", label: "Vertical Titles", component: Stepper15Example },
	{ id: "c-stepper-16", label: "Delivery Stops", component: Stepper16Example },
	{ id: "c-stepper-17", label: "Dotted Progress", component: Stepper17Example },
	{ id: "c-stepper-18", label: "Stage Details", component: Stepper18Example },
	{ id: "c-stepper-19", label: "Frame Icon Tiles", component: Stepper19Example },
	{ id: "c-stepper-20", label: "Purchase Orders", component: Stepper20Example },
	{ id: "c-stepper-21", label: "Security Checks", component: Stepper21Example },
	{ id: "c-stepper-22", label: "Bottom Color Bars", component: Stepper22Example },
	{ id: "c-stepper-23", label: "Top Color Bars", component: Stepper23Example },
	{ id: "c-stepper-24", label: "Icon Tile Rows", component: Stepper24Example },
	{ id: "c-stepper-25", label: "Phase Track", component: Stepper25Example },
	{ id: "c-stepper-26", label: "Timestamped Checkpoints", component: Stepper26Example },
	{ id: "c-stepper-27", label: "Transit Arrow", component: Stepper27Example },
	{ id: "c-stepper-28", label: "Breadcrumb Steps", component: Stepper28Example },
	{ id: "c-stepper-29", label: "Compact Inline", component: Stepper29Example },
	{ id: "c-stepper-30", label: "Truck Route", component: Stepper30Example },
	{ id: "c-stepper-31", label: "Chevron Icon Tiles", component: Stepper31Example },
	{ id: "c-stepper-32", label: "Numbered Chevrons", component: Stepper32Example },
	{ id: "c-stepper-33", label: "Filled Chevrons", component: Stepper33Example },
	{ id: "c-stepper-34", label: "Outlined Chevrons", component: Stepper34Example },
	{ id: "c-stepper-35", label: "Flat Chevrons", component: Stepper35Example },
	{ id: "c-stepper-36", label: "Shipping Route", component: Stepper36Example },
	{ id: "c-stepper-37", label: "Horizontal Step Cards", component: Stepper37Example },
	{ id: "c-stepper-38", label: "Shipment Progress", component: Stepper38Example },
	{ id: "c-stepper-39", label: "Vertical Step Cards", component: Stepper39Example },
	{ id: "c-stepper-40", label: "Side Rail Icons", component: Stepper40Example },
	{ id: "c-stepper-41", label: "Status List", component: Stepper41Example },
	{ id: "c-stepper-42", label: "Vertical Status Bars", component: Stepper42Example },
	{ id: "c-stepper-43", label: "Collapsible Sub-Steps", component: Stepper43Example },
	{ id: "c-stepper-44", label: "Right-Aligned Sub-Steps", component: Stepper44Example },
];

export function StepperExamples(): React.JSX.Element {
	return <ExampleGrid examples={STEPPER_EXAMPLES} />;
}
