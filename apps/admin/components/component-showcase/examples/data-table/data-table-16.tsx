"use client";

import type * as React from "react";

import { DataTable, type DataTableHeading, type DataTableLayout, type DataTableVirtualize } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

/** How many times the sample is repeated: 20 sections x 250 = 5,000 rows. */
const REPEAT_COUNT = 250;

const MANY_SECTIONS: readonly DocumentSection[] = Array.from({ length: REPEAT_COUNT }, (_repeat, repeat) =>
	DOCUMENT_SECTIONS.map((section): DocumentSection => ({ ...section, id: `${section.id}-${String(repeat)}`, header: `${section.header} ${String(repeat + 1)}` })),
).flat();

const HEADING: DataTableHeading = { title: "Proposal sections", description: `${MANY_SECTIONS.length.toLocaleString("en-US")} rows, drawn a screenful at a time.` };

/** Only the rows in view are in the page, so the body needs a height to scroll in. */
const MAX_BODY_HEIGHT = 420;
const LAYOUT: DataTableLayout = { maxHeight: MAX_BODY_HEIGHT, stickyHeader: true, density: "compact" };

const VIRTUALIZE: DataTableVirtualize = { rows: true };

/** Scroll the body: sorting still orders all 5,000 rows, but the page only ever holds the ones on screen. */
export function DataTable16Example(): React.JSX.Element {
	return <DataTable data={MANY_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} heading={HEADING} layout={LAYOUT} virtualize={VIRTUALIZE} />;
}
