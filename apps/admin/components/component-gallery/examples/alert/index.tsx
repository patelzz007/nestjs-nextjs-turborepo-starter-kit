"use client";

// The Alert examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Alert1Example } from "@/components/component-gallery/examples/alert/alert-1";
import { Alert2Example } from "@/components/component-gallery/examples/alert/alert-2";
import { Alert3Example } from "@/components/component-gallery/examples/alert/alert-3";
import { Alert4Example } from "@/components/component-gallery/examples/alert/alert-4";
import { Alert5Example } from "@/components/component-gallery/examples/alert/alert-5";
import { Alert6Example } from "@/components/component-gallery/examples/alert/alert-6";
import { Alert7Example } from "@/components/component-gallery/examples/alert/alert-7";
import { Alert8Example } from "@/components/component-gallery/examples/alert/alert-8";
import { Alert9Example } from "@/components/component-gallery/examples/alert/alert-9";
import { Alert10Example } from "@/components/component-gallery/examples/alert/alert-10";
import { Alert11Example } from "@/components/component-gallery/examples/alert/alert-11";
import { Alert12Example } from "@/components/component-gallery/examples/alert/alert-12";
import { Alert13Example } from "@/components/component-gallery/examples/alert/alert-13";
import { Alert14Example } from "@/components/component-gallery/examples/alert/alert-14";
import { Alert15Example } from "@/components/component-gallery/examples/alert/alert-15";
import { Alert16Example } from "@/components/component-gallery/examples/alert/alert-16";
import { Alert17Example } from "@/components/component-gallery/examples/alert/alert-17";
import { Alert18Example } from "@/components/component-gallery/examples/alert/alert-18";
import { Alert19Example } from "@/components/component-gallery/examples/alert/alert-19";
import { Alert20Example } from "@/components/component-gallery/examples/alert/alert-20";

export const ALERT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-alert-1", label: "Title & Description", component: Alert1Example },
	{ id: "c-alert-2", label: "Leading Icon", component: Alert2Example },
	{ id: "c-alert-3", label: "Icon & Actions", component: Alert3Example },
	{ id: "c-alert-4", label: "Payment Failure", component: Alert4Example },
	{ id: "c-alert-5", label: "Info Variant", component: Alert5Example },
	{ id: "c-alert-6", label: "Success Variant", component: Alert6Example },
	{ id: "c-alert-7", label: "Warning Variant", component: Alert7Example },
	{ id: "c-alert-8", label: "Error Variant", component: Alert8Example },
	{ id: "c-alert-9", label: "Invert Variant", component: Alert9Example },
	{ id: "c-alert-10", label: "Title & Actions", component: Alert10Example },
	{ id: "c-alert-11", label: "Description & Actions", component: Alert11Example },
	{ id: "c-alert-12", label: "Frame Reset Borders", component: Alert12Example },
	{ id: "c-alert-13", label: "Stacked in Frame", component: Alert13Example },
	{ id: "c-alert-14", label: "Frame With Actions", component: Alert14Example },
	{ id: "c-alert-15", label: "Pro Upsell", component: Alert15Example },
	{ id: "c-alert-16", label: "Urgent Billing", component: Alert16Example },
	{ id: "c-alert-17", label: "Service Status", component: Alert17Example },
	{ id: "c-alert-18", label: "Feature Discovery", component: Alert18Example },
	{ id: "c-alert-19", label: "Direct Message", component: Alert19Example },
	{ id: "c-alert-20", label: "Comment Mention", component: Alert20Example },
];

export function AlertExamples(): React.JSX.Element {
	return <ExampleGrid examples={ALERT_EXAMPLES} />;
}
