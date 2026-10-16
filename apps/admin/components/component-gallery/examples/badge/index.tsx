"use client";

// The Badge examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Badge1Example } from "@/components/component-gallery/examples/badge/badge-1";
import { Badge2Example } from "@/components/component-gallery/examples/badge/badge-2";
import { Badge3Example } from "@/components/component-gallery/examples/badge/badge-3";
import { Badge4Example } from "@/components/component-gallery/examples/badge/badge-4";
import { Badge5Example } from "@/components/component-gallery/examples/badge/badge-5";
import { Badge6Example } from "@/components/component-gallery/examples/badge/badge-6";
import { Badge7Example } from "@/components/component-gallery/examples/badge/badge-7";
import { Badge8Example } from "@/components/component-gallery/examples/badge/badge-8";
import { Badge9Example } from "@/components/component-gallery/examples/badge/badge-9";
import { Badge10Example } from "@/components/component-gallery/examples/badge/badge-10";
import { Badge11Example } from "@/components/component-gallery/examples/badge/badge-11";
import { Badge12Example } from "@/components/component-gallery/examples/badge/badge-12";
import { Badge13Example } from "@/components/component-gallery/examples/badge/badge-13";
import { Badge14Example } from "@/components/component-gallery/examples/badge/badge-14";
import { Badge15Example } from "@/components/component-gallery/examples/badge/badge-15";
import { Badge16Example } from "@/components/component-gallery/examples/badge/badge-16";
import { Badge17Example } from "@/components/component-gallery/examples/badge/badge-17";
import { Badge18Example } from "@/components/component-gallery/examples/badge/badge-18";
import { Badge19Example } from "@/components/component-gallery/examples/badge/badge-19";
import { Badge20Example } from "@/components/component-gallery/examples/badge/badge-20";
import { Badge21Example } from "@/components/component-gallery/examples/badge/badge-21";
import { Badge22Example } from "@/components/component-gallery/examples/badge/badge-22";
import { Badge23Example } from "@/components/component-gallery/examples/badge/badge-23";
import { Badge24Example } from "@/components/component-gallery/examples/badge/badge-24";
import { Badge25Example } from "@/components/component-gallery/examples/badge/badge-25";

export const BADGE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-badge-1", label: "Default", component: Badge1Example },
	{ id: "c-badge-2", label: "Secondary", component: Badge2Example },
	{ id: "c-badge-3", label: "Destructive", component: Badge3Example },
	{ id: "c-badge-4", label: "Success", component: Badge4Example },
	{ id: "c-badge-5", label: "Info", component: Badge5Example },
	{ id: "c-badge-6", label: "Warning", component: Badge6Example },
	{ id: "c-badge-7", label: "Outline", component: Badge7Example },
	{ id: "c-badge-8", label: "Primary Outline", component: Badge8Example },
	{ id: "c-badge-9", label: "Destructive Outline", component: Badge9Example },
	{ id: "c-badge-10", label: "Info Outline", component: Badge10Example },
	{ id: "c-badge-11", label: "Success Outline", component: Badge11Example },
	{ id: "c-badge-12", label: "Warning Outline", component: Badge12Example },
	{ id: "c-badge-13", label: "Primary Light", component: Badge13Example },
	{ id: "c-badge-14", label: "Destructive Light", component: Badge14Example },
	{ id: "c-badge-15", label: "Success Light", component: Badge15Example },
	{ id: "c-badge-16", label: "Info Light", component: Badge16Example },
	{ id: "c-badge-17", label: "Warning Light", component: Badge17Example },
	{ id: "c-badge-18", label: "Sizes", component: Badge18Example },
	{ id: "c-badge-19", label: "Full Radius", component: Badge19Example },
	{ id: "c-badge-20", label: "With Icon", component: Badge20Example },
	{ id: "c-badge-21", label: "Dismiss Button", component: Badge21Example },
	{ id: "c-badge-22", label: "Status Dot", component: Badge22Example },
	{ id: "c-badge-23", label: "As Link", component: Badge23Example },
	{ id: "c-badge-24", label: "With Avatar", component: Badge24Example },
	{ id: "c-badge-25", label: "With Flag", component: Badge25Example },
];

export function BadgeExamples(): React.JSX.Element {
	return <ExampleGrid examples={BADGE_EXAMPLES} />;
}
