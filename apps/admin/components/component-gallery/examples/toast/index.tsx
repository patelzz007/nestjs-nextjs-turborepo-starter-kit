"use client";

// The Toast examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Sonner1Example } from "@/components/component-gallery/examples/toast/sonner-1";
import { Sonner2Example } from "@/components/component-gallery/examples/toast/sonner-2";
import { Sonner3Example } from "@/components/component-gallery/examples/toast/sonner-3";
import { Sonner4Example } from "@/components/component-gallery/examples/toast/sonner-4";
import { Sonner5Example } from "@/components/component-gallery/examples/toast/sonner-5";
import { Sonner6Example } from "@/components/component-gallery/examples/toast/sonner-6";
import { Sonner7Example } from "@/components/component-gallery/examples/toast/sonner-7";
import { Sonner8Example } from "@/components/component-gallery/examples/toast/sonner-8";
import { Sonner9Example } from "@/components/component-gallery/examples/toast/sonner-9";
import { Sonner10Example } from "@/components/component-gallery/examples/toast/sonner-10";
import { Sonner11Example } from "@/components/component-gallery/examples/toast/sonner-11";
import { Sonner12Example } from "@/components/component-gallery/examples/toast/sonner-12";
import { Sonner13Example } from "@/components/component-gallery/examples/toast/sonner-13";
import { Sonner14Example } from "@/components/component-gallery/examples/toast/sonner-14";
import { Sonner15Example } from "@/components/component-gallery/examples/toast/sonner-15";
import { Sonner16Example } from "@/components/component-gallery/examples/toast/sonner-16";
import { Sonner17Example } from "@/components/component-gallery/examples/toast/sonner-17";
import { Sonner18Example } from "@/components/component-gallery/examples/toast/sonner-18";
import { Sonner19Example } from "@/components/component-gallery/examples/toast/sonner-19";
import { Sonner20Example } from "@/components/component-gallery/examples/toast/sonner-20";
import { Sonner21Example } from "@/components/component-gallery/examples/toast/sonner-21";

export const TOAST_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-sonner-1", label: "Basic", component: Sonner1Example },
	{ id: "c-sonner-2", label: "With Description", component: Sonner2Example },
	{ id: "c-sonner-3", label: "Positions", component: Sonner3Example },
	{ id: "c-sonner-4", label: "Variant Icons", component: Sonner4Example },
	{ id: "c-sonner-5", label: "Durations", component: Sonner5Example },
	{ id: "c-sonner-6", label: "Action Button", component: Sonner6Example },
	{ id: "c-sonner-7", label: "Promise", component: Sonner7Example },
	{ id: "c-sonner-8", label: "Action & Close", component: Sonner8Example },
	{ id: "c-sonner-9", label: "Rich Content", component: Sonner9Example },
	{ id: "c-sonner-10", label: "Upload Progress", component: Sonner10Example },
	{ id: "c-sonner-11", label: "Status Alert", component: Sonner11Example },
	{ id: "c-sonner-12", label: "Info with Action", component: Sonner12Example },
	{ id: "c-sonner-13", label: "Success with Action", component: Sonner13Example },
	{ id: "c-sonner-14", label: "Error with Details", component: Sonner14Example },
	{ id: "c-sonner-15", label: "Avatar Icon", component: Sonner15Example },
	{ id: "c-sonner-16", label: "Warning with Action", component: Sonner16Example },
	{ id: "c-sonner-17", label: "Avatar Group", component: Sonner17Example },
	{ id: "c-sonner-18", label: "Close Button", component: Sonner18Example },
	{ id: "c-sonner-19", label: "Custom Icon", component: Sonner19Example },
	{ id: "c-sonner-20", label: "Integration", component: Sonner20Example },
	{ id: "c-sonner-21", label: "Updatable", component: Sonner21Example },
];

export function ToastExamples(): React.JSX.Element {
	return <ExampleGrid examples={TOAST_EXAMPLES} />;
}
