"use client";

import type * as React from "react";

import { PLATFORM_DISPLAY_REGION, utcEpochMs } from "@workspace/shared";
import { DataTable, type DataTableColumns, type DataTableFilter, type DataTableSortingOptions } from "@workspace/ui/components/data-table";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";

import { DOCUMENT_SECTIONS, SectionStatusBadge, STATUS_FILTER, type DocumentSection } from "./data-table-sample";

/** A section with the day it is due. The day is stored as the epoch milliseconds of its UTC midnight. */
interface DueSection extends DocumentSection {
	readonly dueOnEpochMs: number;
}

function getDueSectionId(section: DueSection): string {
	return section.id;
}

const DUE_YEAR = 2026;
const DUE_MONTH = 11;
/** Sample due days: one section every other day of November, in the order of the sample. */
const DAYS_BETWEEN_SECTIONS = 2;
const SHOWN_SECTION_COUNT = 12;

const DUE_SECTIONS: readonly DueSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT).map((section, index) => ({
	...section,
	dueOnEpochMs: utcEpochMs(DUE_YEAR, DUE_MONTH, 1 + index * DAYS_BETWEEN_SECTIONS),
}));

const COLUMNS: DataTableColumns<DueSection> = [
	{ accessorKey: "header", header: "Section", size: 260 },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{
		accessorKey: "dueOnEpochMs",
		header: "Due",
		size: 160,
		cell: ({ row }): string => formatEpochMs(row.original.dueOnEpochMs, "date", PLATFORM_DISPLAY_REGION),
	},
	{ accessorKey: "reviewer", header: "Reviewer", size: 180 },
];

// `zone: "utc"` because a due DAY is stored as its UTC midnight and must read as the same day wherever the reader
// sits. Leave `zone` out for a timestamp ("created at"), which is read on the reader's own calendar.
const FILTERS: readonly DataTableFilter[] = [{ kind: "date-range", column: "dueOnEpochMs", label: "Due date", zone: "utc" }, STATUS_FILTER];

const SORTING: DataTableSortingOptions = { initial: [{ id: "dueOnEpochMs", desc: false }] };

/**
 * A `date-range` filter picks a range of days from a calendar; both end days are included. Pick the first day, then
 * the last. It works together with the other filters, and "Clear dates" inside it removes only the range.
 */
export function DataTable30Example(): React.JSX.Element {
	return <DataTable data={DUE_SECTIONS} columns={COLUMNS} getRowId={getDueSectionId} filters={FILTERS} sorting={SORTING} />;
}
