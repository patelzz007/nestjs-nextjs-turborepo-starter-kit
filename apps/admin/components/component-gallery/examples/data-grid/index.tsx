"use client";

// The DataGrid examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { DataGrid1Example } from "@/components/component-gallery/examples/data-grid/data-grid-1";
import { DataGrid2Example } from "@/components/component-gallery/examples/data-grid/data-grid-2";
import { DataGrid3Example } from "@/components/component-gallery/examples/data-grid/data-grid-3";
import { DataGrid4Example } from "@/components/component-gallery/examples/data-grid/data-grid-4";
import { DataGrid5Example } from "@/components/component-gallery/examples/data-grid/data-grid-5";
import { DataGrid6Example } from "@/components/component-gallery/examples/data-grid/data-grid-6";
import { DataGrid7Example } from "@/components/component-gallery/examples/data-grid/data-grid-7";
import { DataGrid8Example } from "@/components/component-gallery/examples/data-grid/data-grid-8";
import { DataGrid9Example } from "@/components/component-gallery/examples/data-grid/data-grid-9";
import { DataGrid10Example } from "@/components/component-gallery/examples/data-grid/data-grid-10";
import { DataGrid11Example } from "@/components/component-gallery/examples/data-grid/data-grid-11";
import { DataGrid12Example } from "@/components/component-gallery/examples/data-grid/data-grid-12";
import { DataGrid13Example } from "@/components/component-gallery/examples/data-grid/data-grid-13";
import { DataGrid14Example } from "@/components/component-gallery/examples/data-grid/data-grid-14";
import { DataGrid15Example } from "@/components/component-gallery/examples/data-grid/data-grid-15";
import { DataGrid16Example } from "@/components/component-gallery/examples/data-grid/data-grid-16";
import { DataGrid17Example } from "@/components/component-gallery/examples/data-grid/data-grid-17";
import { DataGrid18Example } from "@/components/component-gallery/examples/data-grid/data-grid-18";
import { DataGrid19Example } from "@/components/component-gallery/examples/data-grid/data-grid-19";
import { DataGrid20Example } from "@/components/component-gallery/examples/data-grid/data-grid-20";
import { DataGrid21Example } from "@/components/component-gallery/examples/data-grid/data-grid-21";
import { DataGrid22Example } from "@/components/component-gallery/examples/data-grid/data-grid-22";
import { DataGrid23Example } from "@/components/component-gallery/examples/data-grid/data-grid-23";
import { DataGrid24Example } from "@/components/component-gallery/examples/data-grid/data-grid-24";
import { DataGrid25Example } from "@/components/component-gallery/examples/data-grid/data-grid-25";
import { DataGrid26Example } from "@/components/component-gallery/examples/data-grid/data-grid-26";
import { DataGrid27Example } from "@/components/component-gallery/examples/data-grid/data-grid-27";
import { DataGrid28Example } from "@/components/component-gallery/examples/data-grid/data-grid-28";
import { DataGrid29Example } from "@/components/component-gallery/examples/data-grid/data-grid-29";
import { DataGrid30Example } from "@/components/component-gallery/examples/data-grid/data-grid-30";
import { DataGrid31Example } from "@/components/component-gallery/examples/data-grid/data-grid-31";
import { DataGrid32Example } from "@/components/component-gallery/examples/data-grid/data-grid-32";
import { DataGrid33Example } from "@/components/component-gallery/examples/data-grid/data-grid-33";
import { DataGrid34Example } from "@/components/component-gallery/examples/data-grid/data-grid-34";

export const DATA_GRID_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-data-grid-1", label: "Pagination", component: DataGrid1Example },
	{ id: "c-data-grid-2", label: "Cell Borders", component: DataGrid2Example },
	{ id: "c-data-grid-3", label: "Dense Layout", component: DataGrid3Example },
	{ id: "c-data-grid-4", label: "Borderless", component: DataGrid4Example },
	{ id: "c-data-grid-5", label: "Striped Rows", component: DataGrid5Example },
	{ id: "c-data-grid-6", label: "Auto Width", component: DataGrid6Example },
	{ id: "c-data-grid-7", label: "Row Selection", component: DataGrid7Example },
	{ id: "c-data-grid-8", label: "Expandable Rows", component: DataGrid8Example },
	{ id: "c-data-grid-9", label: "Sub Table", component: DataGrid9Example },
	{ id: "c-data-grid-10", label: "Column Icons", component: DataGrid10Example },
	{ id: "c-data-grid-11", label: "Sortable Columns", component: DataGrid11Example },
	{ id: "c-data-grid-12", label: "Movable Columns", component: DataGrid12Example },
	{ id: "c-data-grid-13", label: "Draggable Columns", component: DataGrid13Example },
	{ id: "c-data-grid-14", label: "Draggable Rows", component: DataGrid14Example },
	{ id: "c-data-grid-15", label: "Column Resizing", component: DataGrid15Example },
	{ id: "c-data-grid-16", label: "Pinnable Columns", component: DataGrid16Example },
	{ id: "c-data-grid-17", label: "Sticky Header", component: DataGrid17Example },
	{ id: "c-data-grid-18", label: "Column Controls", component: DataGrid18Example },
	{ id: "c-data-grid-19", label: "Card Container", component: DataGrid19Example },
	{ id: "c-data-grid-20", label: "Column Visibility", component: DataGrid20Example },
	{ id: "c-data-grid-21", label: "Loading Skeleton", component: DataGrid21Example },
	{ id: "c-data-grid-22", label: "CRUD Admin", component: DataGrid22Example },
	{ id: "c-data-grid-23", label: "CRUD in Frame", component: DataGrid23Example },
	{ id: "c-data-grid-24", label: "Totals Footer", component: DataGrid24Example },
	{ id: "c-data-grid-25", label: "Summary Stats Footer", component: DataGrid25Example },
	{ id: "c-data-grid-26", label: "Aggregate Footer", component: DataGrid26Example },
	{ id: "c-data-grid-27", label: "Local Infinite Scroll", component: DataGrid27Example },
	{ id: "c-data-grid-28", label: "Remote Infinite Scroll", component: DataGrid28Example },
	{ id: "c-data-grid-29", label: "Row Pinning", component: DataGrid29Example },
	{ id: "c-data-grid-30", label: "Tree Rows", component: DataGrid30Example },
	{ id: "c-data-grid-31", label: "Spreadsheet Editing", component: DataGrid31Example },
	{ id: "c-data-grid-32", label: "Column Virtualization", component: DataGrid32Example },
	{ id: "c-data-grid-33", label: "Localized Labels", component: DataGrid33Example },
	{ id: "c-data-grid-34", label: "Server-Side Pagination", component: DataGrid34Example },
];

export function DataGridExamples(): React.JSX.Element {
	return <ExampleGrid examples={DATA_GRID_EXAMPLES} />;
}
