"use client";

// The Calendar examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Calendar1Example } from "@/components/component-gallery/examples/calendar/calendar-1";
import { Calendar2Example } from "@/components/component-gallery/examples/calendar/calendar-2";
import { Calendar3Example } from "@/components/component-gallery/examples/calendar/calendar-3";
import { Calendar4Example } from "@/components/component-gallery/examples/calendar/calendar-4";
import { Calendar5Example } from "@/components/component-gallery/examples/calendar/calendar-5";
import { Calendar6Example } from "@/components/component-gallery/examples/calendar/calendar-6";
import { Calendar7Example } from "@/components/component-gallery/examples/calendar/calendar-7";
import { Calendar8Example } from "@/components/component-gallery/examples/calendar/calendar-8";
import { Calendar9Example } from "@/components/component-gallery/examples/calendar/calendar-9";
import { Calendar10Example } from "@/components/component-gallery/examples/calendar/calendar-10";
import { Calendar11Example } from "@/components/component-gallery/examples/calendar/calendar-11";
import { Calendar12Example } from "@/components/component-gallery/examples/calendar/calendar-12";
import { Calendar13Example } from "@/components/component-gallery/examples/calendar/calendar-13";
import { Calendar14Example } from "@/components/component-gallery/examples/calendar/calendar-14";
import { Calendar15Example } from "@/components/component-gallery/examples/calendar/calendar-15";
import { Calendar16Example } from "@/components/component-gallery/examples/calendar/calendar-16";
import { Calendar17Example } from "@/components/component-gallery/examples/calendar/calendar-17";
import { Calendar18Example } from "@/components/component-gallery/examples/calendar/calendar-18";
import { Calendar19Example } from "@/components/component-gallery/examples/calendar/calendar-19";
import { Calendar20Example } from "@/components/component-gallery/examples/calendar/calendar-20";
import { Calendar21Example } from "@/components/component-gallery/examples/calendar/calendar-21";
import { Calendar22Example } from "@/components/component-gallery/examples/calendar/calendar-22";
import { Calendar23Example } from "@/components/component-gallery/examples/calendar/calendar-23";
import { Calendar24Example } from "@/components/component-gallery/examples/calendar/calendar-24";
import { Calendar25Example } from "@/components/component-gallery/examples/calendar/calendar-25";
import { Calendar26Example } from "@/components/component-gallery/examples/calendar/calendar-26";
import { Calendar27Example } from "@/components/component-gallery/examples/calendar/calendar-27";
import { Calendar28Example } from "@/components/component-gallery/examples/calendar/calendar-28";
import { Calendar29Example } from "@/components/component-gallery/examples/calendar/calendar-29";
import { Calendar30Example } from "@/components/component-gallery/examples/calendar/calendar-30";

export const CALENDAR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-calendar-1", label: "Basic", component: Calendar1Example },
	{ id: "c-calendar-2", label: "Range", component: Calendar2Example },
	{ id: "c-calendar-3", label: "Disabled Dates", component: Calendar3Example },
	{ id: "c-calendar-4", label: "Multiple Days", component: Calendar4Example },
	{ id: "c-calendar-5", label: "Circular Days", component: Calendar5Example },
	{ id: "c-calendar-6", label: "Circular Range", component: Calendar6Example },
	{ id: "c-calendar-7", label: "Right Navigation", component: Calendar7Example },
	{ id: "c-calendar-8", label: "Month Year Select", component: Calendar8Example },
	{ id: "c-calendar-9", label: "Year Select", component: Calendar9Example },
	{ id: "c-calendar-10", label: "Week Numbers", component: Calendar10Example },
	{ id: "c-calendar-11", label: "Current Month Button", component: Calendar11Example },
	{ id: "c-calendar-12", label: "Today Button", component: Calendar12Example },
	{ id: "c-calendar-13", label: "Year View", component: Calendar13Example },
	{ id: "c-calendar-14", label: "Time Slots", component: Calendar14Example },
	{ id: "c-calendar-15", label: "Date Presets", component: Calendar15Example },
	{ id: "c-calendar-16", label: "Range Presets", component: Calendar16Example },
	{ id: "c-calendar-17", label: "Pricing", component: Calendar17Example },
	{ id: "c-calendar-18", label: "Forward Presets", component: Calendar18Example },
	{ id: "c-calendar-19", label: "Appointment", component: Calendar19Example },
	{ id: "c-calendar-20", label: "Two Months", component: Calendar20Example },
	{ id: "c-calendar-21", label: "Two Month Range", component: Calendar21Example },
	{ id: "c-calendar-22", label: "Event List", component: Calendar22Example },
	{ id: "c-calendar-23", label: "Localized", component: Calendar23Example },
	{ id: "c-calendar-24", label: "Date Picker", component: Calendar24Example },
	{ id: "c-calendar-25", label: "Date Range Picker", component: Calendar25Example },
	{ id: "c-calendar-26", label: "Picker Year View", component: Calendar26Example },
	{ id: "c-calendar-27", label: "Picker Time Slots", component: Calendar27Example },
	{ id: "c-calendar-28", label: "Picker Presets", component: Calendar28Example },
	{ id: "c-calendar-29", label: "Range Picker Presets", component: Calendar29Example },
	{ id: "c-calendar-30", label: "Date Time Range", component: Calendar30Example },
];

export function CalendarExamples(): React.JSX.Element {
	return <ExampleGrid examples={CALENDAR_EXAMPLES} />;
}
