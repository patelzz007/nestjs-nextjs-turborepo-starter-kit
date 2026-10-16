"use client";

// The Frame examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Frame1Example } from "@/components/component-gallery/examples/frame/frame-1";
import { Frame2Example } from "@/components/component-gallery/examples/frame/frame-2";
import { Frame3Example } from "@/components/component-gallery/examples/frame/frame-3";
import { Frame4Example } from "@/components/component-gallery/examples/frame/frame-4";
import { Frame5Example } from "@/components/component-gallery/examples/frame/frame-5";
import { Frame6Example } from "@/components/component-gallery/examples/frame/frame-6";
import { Frame7Example } from "@/components/component-gallery/examples/frame/frame-7";
import { Frame8Example } from "@/components/component-gallery/examples/frame/frame-8";
import { Frame9Example } from "@/components/component-gallery/examples/frame/frame-9";
import { Frame10Example } from "@/components/component-gallery/examples/frame/frame-10";
import { Frame11Example } from "@/components/component-gallery/examples/frame/frame-11";
import { Frame12Example } from "@/components/component-gallery/examples/frame/frame-12";
import { Frame13Example } from "@/components/component-gallery/examples/frame/frame-13";
import { Frame14Example } from "@/components/component-gallery/examples/frame/frame-14";
import { Frame15Example } from "@/components/component-gallery/examples/frame/frame-15";
import { Frame16Example } from "@/components/component-gallery/examples/frame/frame-16";
import { Frame17Example } from "@/components/component-gallery/examples/frame/frame-17";
import { Frame18Example } from "@/components/component-gallery/examples/frame/frame-18";
import { Frame19Example } from "@/components/component-gallery/examples/frame/frame-19";

export const FRAME_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-frame-1", label: "Basic", component: Frame1Example },
	{ id: "c-frame-2", label: "Separated Panels", component: Frame2Example },
	{ id: "c-frame-3", label: "Stacked Panels", component: Frame3Example },
	{ id: "c-frame-4", label: "Stacked Dense", component: Frame4Example },
	{ id: "c-frame-5", label: "Collapsible Panels", component: Frame5Example },
	{ id: "c-frame-6", label: "Ghost Variant", component: Frame6Example },
	{ id: "c-frame-7", label: "Dense Layout", component: Frame7Example },
	{ id: "c-frame-8", label: "Stacked Rows", component: Frame8Example },
	{ id: "c-frame-9", label: "Extra Small Spacing", component: Frame9Example },
	{ id: "c-frame-10", label: "Small Spacing", component: Frame10Example },
	{ id: "c-frame-11", label: "Default Spacing", component: Frame11Example },
	{ id: "c-frame-12", label: "Large Spacing", component: Frame12Example },
	{ id: "c-frame-13", label: "Small Radius", component: Frame13Example },
	{ id: "c-frame-14", label: "Medium Radius", component: Frame14Example },
	{ id: "c-frame-15", label: "Large Radius", component: Frame15Example },
	{ id: "c-frame-16", label: "Default Radius", component: Frame16Example },
	{ id: "c-frame-17", label: "Extra Large Radius", component: Frame17Example },
	{ id: "c-frame-18", label: "Content-Only Panels", component: Frame18Example },
	{ id: "c-frame-19", label: "Stacked Content-Only", component: Frame19Example },
];

export function FrameExamples(): React.JSX.Element {
	return <ExampleGrid examples={FRAME_EXAMPLES} />;
}
