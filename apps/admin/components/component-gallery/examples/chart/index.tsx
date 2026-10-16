"use client";

// The Chart examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Chart1Example } from "@/components/component-gallery/examples/chart/chart-1";
import { Chart2Example } from "@/components/component-gallery/examples/chart/chart-2";
import { Chart3Example } from "@/components/component-gallery/examples/chart/chart-3";
import { Chart4Example } from "@/components/component-gallery/examples/chart/chart-4";
import { Chart5Example } from "@/components/component-gallery/examples/chart/chart-5";
import { Chart6Example } from "@/components/component-gallery/examples/chart/chart-6";
import { Chart7Example } from "@/components/component-gallery/examples/chart/chart-7";
import { Chart8Example } from "@/components/component-gallery/examples/chart/chart-8";
import { Chart9Example } from "@/components/component-gallery/examples/chart/chart-9";
import { Chart10Example } from "@/components/component-gallery/examples/chart/chart-10";
import { Chart11Example } from "@/components/component-gallery/examples/chart/chart-11";
import { Chart12Example } from "@/components/component-gallery/examples/chart/chart-12";
import { Chart13Example } from "@/components/component-gallery/examples/chart/chart-13";
import { Chart14Example } from "@/components/component-gallery/examples/chart/chart-14";
import { Chart15Example } from "@/components/component-gallery/examples/chart/chart-15";
import { Chart16Example } from "@/components/component-gallery/examples/chart/chart-16";
import { Chart17Example } from "@/components/component-gallery/examples/chart/chart-17";
import { Chart18Example } from "@/components/component-gallery/examples/chart/chart-18";
import { Chart19Example } from "@/components/component-gallery/examples/chart/chart-19";
import { Chart20Example } from "@/components/component-gallery/examples/chart/chart-20";
import { Chart21Example } from "@/components/component-gallery/examples/chart/chart-21";
import { Chart22Example } from "@/components/component-gallery/examples/chart/chart-22";
import { Chart23Example } from "@/components/component-gallery/examples/chart/chart-23";
import { Chart24Example } from "@/components/component-gallery/examples/chart/chart-24";
import { Chart25Example } from "@/components/component-gallery/examples/chart/chart-25";

export const CHART_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-chart-1", label: "Basic Bars", component: Chart1Example },
	{ id: "c-chart-2", label: "Multi-Dataset Bars", component: Chart2Example },
	{ id: "c-chart-3", label: "Diagonal Stripe Bars", component: Chart3Example },
	{ id: "c-chart-4", label: "Dotted Bars", component: Chart4Example },
	{ id: "c-chart-5", label: "Striped Solid Bars", component: Chart5Example },
	{ id: "c-chart-6", label: "3D Gradient Bars", component: Chart6Example },
	{ id: "c-chart-7", label: "Gradient Bars", component: Chart7Example },
	{ id: "c-chart-8", label: "Isometric Bars", component: Chart8Example },
	{ id: "c-chart-9", label: "Dotted Solid Bars", component: Chart9Example },
	{ id: "c-chart-10", label: "Duotone Bars", component: Chart10Example },
	{ id: "c-chart-11", label: "Animated Monochrome Bars", component: Chart11Example },
	{ id: "c-chart-12", label: "Horizontal Bars", component: Chart12Example },
	{ id: "c-chart-13", label: "Gradient Area", component: Chart13Example },
	{ id: "c-chart-14", label: "Stacked Dashed Area", component: Chart14Example },
	{ id: "c-chart-15", label: "Dotted Step Area", component: Chart15Example },
	{ id: "c-chart-16", label: "Glowing Dot Area", component: Chart16Example },
	{ id: "c-chart-17", label: "Forecast Line", component: Chart17Example },
	{ id: "c-chart-18", label: "Crosshatch Area", component: Chart18Example },
	{ id: "c-chart-19", label: "Donut Center Total", component: Chart19Example },
	{ id: "c-chart-20", label: "Donut Center Stats", component: Chart20Example },
	{ id: "c-chart-21", label: "Striped Pie", component: Chart21Example },
	{ id: "c-chart-22", label: "Active Segment Donut", component: Chart22Example },
	{ id: "c-chart-23", label: "Gradient Radar", component: Chart23Example },
	{ id: "c-chart-24", label: "Glowing Stroke Radar", component: Chart24Example },
	{ id: "c-chart-25", label: "Radial Scores", component: Chart25Example },
];

export function ChartExamples(): React.JSX.Element {
	return <ExampleGrid examples={CHART_EXAMPLES} />;
}
