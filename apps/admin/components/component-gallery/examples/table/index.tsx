"use client";

// The Table examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Table1Example } from "@/components/component-gallery/examples/table/table-1";
import { Table2Example } from "@/components/component-gallery/examples/table/table-2";
import { Table3Example } from "@/components/component-gallery/examples/table/table-3";
import { Table4Example } from "@/components/component-gallery/examples/table/table-4";
import { Table5Example } from "@/components/component-gallery/examples/table/table-5";
import { Table6Example } from "@/components/component-gallery/examples/table/table-6";
import { Table7Example } from "@/components/component-gallery/examples/table/table-7";
import { Table8Example } from "@/components/component-gallery/examples/table/table-8";
import { Table9Example } from "@/components/component-gallery/examples/table/table-9";
import { Table10Example } from "@/components/component-gallery/examples/table/table-10";
import { Table11Example } from "@/components/component-gallery/examples/table/table-11";
import { Table12Example } from "@/components/component-gallery/examples/table/table-12";
import { Table13Example } from "@/components/component-gallery/examples/table/table-13";
import { Table14Example } from "@/components/component-gallery/examples/table/table-14";
import { Table15Example } from "@/components/component-gallery/examples/table/table-15";
import { Table16Example } from "@/components/component-gallery/examples/table/table-16";
import { Table17Example } from "@/components/component-gallery/examples/table/table-17";

export const TABLE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-table-1", label: "Basic", component: Table1Example },
	{ id: "c-table-2", label: "With Footer", component: Table2Example },
	{ id: "c-table-3", label: "Status Badges", component: Table3Example },
	{ id: "c-table-4", label: "Actions Column", component: Table4Example },
	{ id: "c-table-5", label: "Interactive Rows", component: Table5Example },
	{ id: "c-table-6", label: "Team Members", component: Table6Example },
	{ id: "c-table-7", label: "Orders", component: Table7Example },
	{ id: "c-table-8", label: "Projects", component: Table8Example },
	{ id: "c-table-9", label: "Activity Log", component: Table9Example },
	{ id: "c-table-10", label: "Subscriptions", component: Table10Example },
	{ id: "c-table-11", label: "Inventory", component: Table11Example },
	{ id: "c-table-12", label: "API Keys", component: Table12Example },
	{ id: "c-table-13", label: "File Manager", component: Table13Example },
	{ id: "c-table-14", label: "Issues", component: Table14Example },
	{ id: "c-table-15", label: "Leaderboard", component: Table15Example },
	{ id: "c-table-16", label: "Employee Profile", component: Table16Example },
	{ id: "c-table-17", label: "Server Config", component: Table17Example },
];

export function TableExamples(): React.JSX.Element {
	return <ExampleGrid examples={TABLE_EXAMPLES} />;
}
