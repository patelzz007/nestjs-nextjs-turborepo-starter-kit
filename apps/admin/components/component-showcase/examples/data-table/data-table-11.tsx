"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls, type DataTableColumns } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, NUMERIC_COLUMN_META, SECTION_PAGING, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

/** Every control a header can carry: its menu sorts, pins, moves and hides the column, and its edge resizes it. */
const COLUMN_CONTROLS: DataTableColumnControls = { visibility: true, pinning: true, resizing: true, reordering: true };

// What a column allows is declared on the column: `enableSorting`, `enableHiding`, `enablePinning` and
// `enableResizing` each switch one control off for that column only.
const COLUMNS: DataTableColumns<DocumentSection> = [
	{ accessorKey: "header", header: "Section", size: 260, enableHiding: false },
	{ accessorKey: "type", header: "Type", size: 170 },
	{
		accessorKey: "status",
		header: "Status",
		size: 140,
		// A status has no meaningful order, so this header is a plain title.
		enableSorting: false,
		cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} />,
	},
	{ accessorKey: "target", header: "Target", size: 100, meta: NUMERIC_COLUMN_META },
	{ accessorKey: "limit", header: "Limit", size: 100, meta: NUMERIC_COLUMN_META },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180, enableResizing: false },
];

export function DataTable11Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={COLUMNS} getRowId={getSectionId} columnControls={COLUMN_CONTROLS} paging={SECTION_PAGING} />;
}
