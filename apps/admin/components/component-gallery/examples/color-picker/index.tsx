"use client";

// The ColorPicker examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { ColorPicker1Example } from "@/components/component-gallery/examples/color-picker/color-picker-1";
import { ColorPicker2Example } from "@/components/component-gallery/examples/color-picker/color-picker-2";
import { ColorPicker3Example } from "@/components/component-gallery/examples/color-picker/color-picker-3";
import { ColorPicker4Example } from "@/components/component-gallery/examples/color-picker/color-picker-4";
import { ColorPicker5Example } from "@/components/component-gallery/examples/color-picker/color-picker-5";
import { ColorPicker6Example } from "@/components/component-gallery/examples/color-picker/color-picker-6";
import { ColorPicker7Example } from "@/components/component-gallery/examples/color-picker/color-picker-7";
import { ColorPicker8Example } from "@/components/component-gallery/examples/color-picker/color-picker-8";
import { ColorPicker9Example } from "@/components/component-gallery/examples/color-picker/color-picker-9";
import { ColorPicker10Example } from "@/components/component-gallery/examples/color-picker/color-picker-10";
import { ColorPicker11Example } from "@/components/component-gallery/examples/color-picker/color-picker-11";
import { ColorPicker12Example } from "@/components/component-gallery/examples/color-picker/color-picker-12";
import { ColorPicker13Example } from "@/components/component-gallery/examples/color-picker/color-picker-13";
import { ColorPicker14Example } from "@/components/component-gallery/examples/color-picker/color-picker-14";
import { ColorPicker15Example } from "@/components/component-gallery/examples/color-picker/color-picker-15";

export const COLOR_PICKER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-color-picker-1", label: "Inline Panel", component: ColorPicker1Example },
	{ id: "c-color-picker-2", label: "Popover", component: ColorPicker2Example },
	{ id: "c-color-picker-3", label: "Color Input", component: ColorPicker3Example },
	{ id: "c-color-picker-4", label: "Opacity", component: ColorPicker4Example },
	{ id: "c-color-picker-5", label: "Preset Swatches", component: ColorPicker5Example },
	{ id: "c-color-picker-6", label: "OKLCH Token", component: ColorPicker6Example },
	{ id: "c-color-picker-7", label: "Format Converter", component: ColorPicker7Example },
	{ id: "c-color-picker-8", label: "Hue Wheel", component: ColorPicker8Example },
	{ id: "c-color-picker-9", label: "Recent Colors", component: ColorPicker9Example },
	{ id: "c-color-picker-10", label: "Text & Highlight", component: ColorPicker10Example },
	{ id: "c-color-picker-11", label: "Channel Sliders", component: ColorPicker11Example },
	{ id: "c-color-picker-12", label: "Design Inspector", component: ColorPicker12Example },
	{ id: "c-color-picker-13", label: "Contrast Checker", component: ColorPicker13Example },
	{ id: "c-color-picker-14", label: "Brand Scale", component: ColorPicker14Example },
	{ id: "c-color-picker-15", label: "Form Validation", component: ColorPicker15Example },
];

export function ColorPickerExamples(): React.JSX.Element {
	return <ExampleGrid examples={COLOR_PICKER_EXAMPLES} />;
}
