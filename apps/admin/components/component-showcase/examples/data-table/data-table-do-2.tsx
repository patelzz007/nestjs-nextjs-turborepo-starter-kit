"use client";

import type * as React from "react";

import { DataTable, type DataTableColumns } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

const SHOWN_SECTION_COUNT = 3;
const SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);

const COLUMNS: DataTableColumns<DocumentSection> = [
	{ accessorKey: "header", header: "Section", size: 200 },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
];

export function DataTableDo2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-sm">
			<DataTable data={SECTIONS} columns={COLUMNS} getRowId={getSectionId} />
		</div>
	);
}
