import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const ROWS = DOCUMENT_SECTIONS.slice(0, 4);

// Rows tracked by id (`getRowId`): tick a row, sort, and the tick stays on that row.
export function DataTableDo1Example(): React.JSX.Element {
	return <DataTable data={ROWS} columns={SECTION_COLUMNS} pagination={SECTION_PAGINATION} checkbox />;
}
