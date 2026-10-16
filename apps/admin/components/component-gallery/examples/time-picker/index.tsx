"use client";

// The TimePicker examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { TimePicker1Example } from "@/components/component-gallery/examples/time-picker/time-picker-1";
import { TimePicker2Example } from "@/components/component-gallery/examples/time-picker/time-picker-2";
import { TimePicker3Example } from "@/components/component-gallery/examples/time-picker/time-picker-3";
import { TimePicker4Example } from "@/components/component-gallery/examples/time-picker/time-picker-4";
import { TimePicker5Example } from "@/components/component-gallery/examples/time-picker/time-picker-5";
import { TimePicker6Example } from "@/components/component-gallery/examples/time-picker/time-picker-6";
import { TimePicker7Example } from "@/components/component-gallery/examples/time-picker/time-picker-7";
import { TimePicker8Example } from "@/components/component-gallery/examples/time-picker/time-picker-8";
import { TimePicker9Example } from "@/components/component-gallery/examples/time-picker/time-picker-9";
import { TimePicker10Example } from "@/components/component-gallery/examples/time-picker/time-picker-10";
import { TimePicker11Example } from "@/components/component-gallery/examples/time-picker/time-picker-11";
import { TimePicker12Example } from "@/components/component-gallery/examples/time-picker/time-picker-12";
import { TimePicker13Example } from "@/components/component-gallery/examples/time-picker/time-picker-13";

export const TIME_PICKER_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-time-picker-1", label: "Inline Panel", component: TimePicker1Example },
	{ id: "c-time-picker-2", label: "Popover", component: TimePicker2Example },
	{ id: "c-time-picker-3", label: "Typable Input", component: TimePicker3Example },
	{ id: "c-time-picker-4", label: "12-Hour Seconds", component: TimePicker4Example },
	{ id: "c-time-picker-5", label: "Hour Only", component: TimePicker5Example },
	{ id: "c-time-picker-6", label: "Opening Hours", component: TimePicker6Example },
	{ id: "c-time-picker-7", label: "Unavailable Slots", component: TimePicker7Example },
	{ id: "c-time-picker-8", label: "Start & End", component: TimePicker8Example },
	{ id: "c-time-picker-9", label: "Time Zone", component: TimePicker9Example },
	{ id: "c-time-picker-10", label: "Confirm Before Apply", component: TimePicker10Example },
	{ id: "c-time-picker-11", label: "Localized", component: TimePicker11Example },
	{ id: "c-time-picker-12", label: "Form Validation", component: TimePicker12Example },
	{ id: "c-time-picker-13", label: "Date & Time", component: TimePicker13Example },
];

export function TimePickerExamples(): React.JSX.Element {
	return <ExampleGrid examples={TIME_PICKER_EXAMPLES} />;
}
