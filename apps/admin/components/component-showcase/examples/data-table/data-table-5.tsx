"use client";

import type * as React from "react";

import { DataTable, type DataTableCheckboxConfig } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 5;

/** Export the selection (or every row when nothing is selected) as CSV or JSON, leaving the reviewer out. */
const CHECKBOX: DataTableCheckboxConfig<DocumentSection> = {
	export: ["csv", "json"],
	exportFilename: "document-sections",
	exportableColumns: ["header", "type", "status", "target", "limit"],
};

export function DataTable5Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			checkbox={CHECKBOX}
			pageSize={PAGE_SIZE}
			title="Export"
			description="Download the selected rows, or all of them, as CSV or JSON."
		/>
	);
}
