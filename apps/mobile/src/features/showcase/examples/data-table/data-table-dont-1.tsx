import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

const ROWS = DOCUMENT_SECTIONS.slice(0, 4);

// Rows tracked by position (no `getRowId`): tick a row, sort, and the tick lands on whichever row moved there.
export function DataTableDont1Example(): React.JSX.Element {
	return <DataTable data={ROWS} columns={SECTION_COLUMNS} checkbox />;
}
