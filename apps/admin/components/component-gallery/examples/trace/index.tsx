"use client";

// The Trace examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Trace5Example } from "@/components/component-gallery/examples/trace/trace-5";
import { Trace6Example } from "@/components/component-gallery/examples/trace/trace-6";
import { Trace7Example } from "@/components/component-gallery/examples/trace/trace-7";
import { Trace10Example } from "@/components/component-gallery/examples/trace/trace-10";
import { Trace13Example } from "@/components/component-gallery/examples/trace/trace-13";
import { Trace15Example } from "@/components/component-gallery/examples/trace/trace-15";
import { Trace16Example } from "@/components/component-gallery/examples/trace/trace-16";
import { Trace18Example } from "@/components/component-gallery/examples/trace/trace-18";
import { Trace19Example } from "@/components/component-gallery/examples/trace/trace-19";
import { Trace20Example } from "@/components/component-gallery/examples/trace/trace-20";
import { Trace21Example } from "@/components/component-gallery/examples/trace/trace-21";
import { Trace22Example } from "@/components/component-gallery/examples/trace/trace-22";
import { Trace1Example } from "@/components/component-gallery/examples/trace/trace-1";
import { Trace2Example } from "@/components/component-gallery/examples/trace/trace-2";
import { Trace3Example } from "@/components/component-gallery/examples/trace/trace-3";
import { Trace4Example } from "@/components/component-gallery/examples/trace/trace-4";
import { Trace8Example } from "@/components/component-gallery/examples/trace/trace-8";
import { Trace9Example } from "@/components/component-gallery/examples/trace/trace-9";
import { Trace11Example } from "@/components/component-gallery/examples/trace/trace-11";
import { Trace12Example } from "@/components/component-gallery/examples/trace/trace-12";
import { Trace14Example } from "@/components/component-gallery/examples/trace/trace-14";
import { Trace17Example } from "@/components/component-gallery/examples/trace/trace-17";

export const TRACE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-trace-5", label: "Change Approval", component: Trace5Example },
	{ id: "c-trace-6", label: "Cited Sources", component: Trace6Example },
	{ id: "c-trace-7", label: "Support Copilot", component: Trace7Example },
	{ id: "c-trace-10", label: "Request Spans", component: Trace10Example },
	{ id: "c-trace-13", label: "Data Pipeline", component: Trace13Example },
	{ id: "c-trace-15", label: "CSV Import", component: Trace15Example },
	{ id: "c-trace-16", label: "Security Audit", component: Trace16Example },
	{ id: "c-trace-18", label: "Eval Results", component: Trace18Example },
	{ id: "c-trace-19", label: "Access Decision", component: Trace19Example },
	{ id: "c-trace-20", label: "Identity Review", component: Trace20Example },
	{ id: "c-trace-21", label: "Domain Setup", component: Trace21Example },
	{ id: "c-trace-22", label: "Transcode", component: Trace22Example },
	{ id: "c-trace-1", label: "Agent Steps", component: Trace1Example },
	{ id: "c-trace-2", label: "Streaming Run", component: Trace2Example },
	{ id: "c-trace-3", label: "Chat Turn", component: Trace3Example },
	{ id: "c-trace-4", label: "Subagents", component: Trace4Example },
	{ id: "c-trace-8", label: "Install Summary", component: Trace8Example },
	{ id: "c-trace-9", label: "CI Pipeline", component: Trace9Example },
	{ id: "c-trace-11", label: "Error Breadcrumbs", component: Trace11Example },
	{ id: "c-trace-12", label: "Query Plan", component: Trace12Example },
	{ id: "c-trace-14", label: "Webhook Retries", component: Trace14Example },
	{ id: "c-trace-17", label: "Review Findings", component: Trace17Example },
];

export function TraceExamples(): React.JSX.Element {
	return <ExampleGrid examples={TRACE_EXAMPLES} />;
}
