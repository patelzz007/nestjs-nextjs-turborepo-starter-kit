"use client";

// The Slider examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Slider1Example } from "@/components/component-gallery/examples/slider/slider-1";
import { Slider2Example } from "@/components/component-gallery/examples/slider/slider-2";
import { Slider3Example } from "@/components/component-gallery/examples/slider/slider-3";
import { Slider4Example } from "@/components/component-gallery/examples/slider/slider-4";
import { Slider5Example } from "@/components/component-gallery/examples/slider/slider-5";
import { Slider6Example } from "@/components/component-gallery/examples/slider/slider-6";
import { Slider7Example } from "@/components/component-gallery/examples/slider/slider-7";
import { Slider8Example } from "@/components/component-gallery/examples/slider/slider-8";
import { Slider9Example } from "@/components/component-gallery/examples/slider/slider-9";
import { Slider10Example } from "@/components/component-gallery/examples/slider/slider-10";
import { Slider11Example } from "@/components/component-gallery/examples/slider/slider-11";
import { Slider12Example } from "@/components/component-gallery/examples/slider/slider-12";

export const SLIDER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-slider-1", label: "Basic", component: Slider1Example },
	{ id: "c-slider-2", label: "Disabled", component: Slider2Example },
	{ id: "c-slider-3", label: "Multiple Thumbs", component: Slider3Example },
	{ id: "c-slider-4", label: "Vertical", component: Slider4Example },
	{ id: "c-slider-5", label: "Controlled Value", component: Slider5Example },
	{ id: "c-slider-6", label: "Range", component: Slider6Example },
	{ id: "c-slider-7", label: "Number Input", component: Slider7Example },
	{ id: "c-slider-8", label: "Color Temperature", component: Slider8Example },
	{ id: "c-slider-9", label: "Reference Labels", component: Slider9Example },
	{ id: "c-slider-10", label: "Tick Marks", component: Slider10Example },
	{ id: "c-slider-11", label: "Value Tooltip", component: Slider11Example },
	{ id: "c-slider-12", label: "Emoji Rating", component: Slider12Example },
];

export function SliderExamples(): React.JSX.Element {
	return <ExampleGrid examples={SLIDER_EXAMPLES} />;
}
