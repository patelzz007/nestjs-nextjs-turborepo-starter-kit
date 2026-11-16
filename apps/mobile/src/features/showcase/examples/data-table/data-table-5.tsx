import type { DataTableCheckboxConfig } from "@workspace/ui-kit-logic";
import { DataTable } from "@workspace/ui-native/components/data-table";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";

import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;

/** Export the selection (or every row when nothing is selected) as CSV or JSON, leaving the reviewer out. */
const CHECKBOX: DataTableCheckboxConfig<DocumentSection, LucideIcon> = {
	export: ["csv", "json"],
	exportFilename: "document-sections",
	exportableColumns: ["header", "type", "status", "target", "limit"],
};

// The table hands the file to the system share sheet; an app can pass its own `exporter` (save to Files, email).
export function DataTable5Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			checkbox={CHECKBOX}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Export"
			description="Share the selected rows, or all of them, as CSV or JSON."
		/>
	);
}
