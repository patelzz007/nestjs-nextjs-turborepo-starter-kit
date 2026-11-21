"use client";

import type * as React from "react";

import { DataTable, type DataTableExporting, type DataTableFilter, type DataTableSelection } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, STATUS_FILTER, type DocumentSection } from "./data-table-sample";

/**
 * The formats offered, the file's name, and the row fields written and ticked to start with (by key, in order; any field
 * of the row, shown as a column or not). `mode: "dialog"` lets
 * the reader choose the format, the rows (ticked, matching or every row) and the columns, and see the row count
 * first; leave it out for a one-click menu per format.
 */
const EXPORTING: DataTableExporting<DocumentSection> = {
	mode: "dialog",
	formats: ["csv", "xlsx", "json"],
	filename: "proposal-sections",
	keys: ["header", "type", "status", "target", "limit"],
};

const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER];

/** Checkboxes with no bulk actions: ticked rows only choose what the export covers. */
const SELECTION: DataTableSelection<DocumentSection> = {};

/** The export dialog starts on the ticked rows when there are any, otherwise on every row that matches the filters. */
export function DataTable5Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			getRowId={getSectionId}
			exporting={EXPORTING}
			filters={FILTERS}
			selection={SELECTION}
			paging={SECTION_PAGING}
		/>
	);
}
