"use client";

// The Empty examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Empty1Example } from "@/components/component-gallery/examples/empty/empty-1";
import { Empty2Example } from "@/components/component-gallery/examples/empty/empty-2";
import { Empty3Example } from "@/components/component-gallery/examples/empty/empty-3";
import { Empty4Example } from "@/components/component-gallery/examples/empty/empty-4";
import { Empty5Example } from "@/components/component-gallery/examples/empty/empty-5";
import { Empty6Example } from "@/components/component-gallery/examples/empty/empty-6";
import { Empty7Example } from "@/components/component-gallery/examples/empty/empty-7";
import { Empty8Example } from "@/components/component-gallery/examples/empty/empty-8";
import { Empty9Example } from "@/components/component-gallery/examples/empty/empty-9";
import { Empty10Example } from "@/components/component-gallery/examples/empty/empty-10";
import { Empty11Example } from "@/components/component-gallery/examples/empty/empty-11";
import { Empty12Example } from "@/components/component-gallery/examples/empty/empty-12";
import { Empty13Example } from "@/components/component-gallery/examples/empty/empty-13";
import { Empty14Example } from "@/components/component-gallery/examples/empty/empty-14";
import { Empty15Example } from "@/components/component-gallery/examples/empty/empty-15";
import { Empty16Example } from "@/components/component-gallery/examples/empty/empty-16";
import { Empty17Example } from "@/components/component-gallery/examples/empty/empty-17";
import { Empty18Example } from "@/components/component-gallery/examples/empty/empty-18";
import { Empty19Example } from "@/components/component-gallery/examples/empty/empty-19";
import { Empty20Example } from "@/components/component-gallery/examples/empty/empty-20";

export const EMPTY_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-empty-1", label: "Basic", component: Empty1Example },
	{ id: "c-empty-2", label: "No Results", component: Empty2Example },
	{ id: "c-empty-3", label: "Search Input", component: Empty3Example },
	{ id: "c-empty-4", label: "Add Button", component: Empty4Example },
	{ id: "c-empty-5", label: "Documents", component: Empty5Example },
	{ id: "c-empty-6", label: "Dashed Upload", component: Empty6Example },
	{ id: "c-empty-7", label: "Inbox", component: Empty7Example },
	{ id: "c-empty-8", label: "Team Members", component: Empty8Example },
	{ id: "c-empty-9", label: "No Notifications", component: Empty9Example },
	{ id: "c-empty-10", label: "Analytics", component: Empty10Example },
	{ id: "c-empty-11", label: "Bookmarks", component: Empty11Example },
	{ id: "c-empty-12", label: "Tasks", component: Empty12Example },
	{ id: "c-empty-13", label: "Automations", component: Empty13Example },
	{ id: "c-empty-14", label: "Comments Board", component: Empty14Example },
	{ id: "c-empty-15", label: "Stacked Products", component: Empty15Example },
	{ id: "c-empty-16", label: "Search File Cards", component: Empty16Example },
	{ id: "c-empty-17", label: "Chat Bubbles", component: Empty17Example },
	{ id: "c-empty-18", label: "Credit Card", component: Empty18Example },
	{ id: "c-empty-19", label: "Connected Nodes", component: Empty19Example },
	{ id: "c-empty-20", label: "Events Calendar", component: Empty20Example },
];

export function EmptyExamples(): React.JSX.Element {
	return <ExampleGrid examples={EMPTY_EXAMPLES} />;
}
