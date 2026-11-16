import { DataTable, type DataTableColumn } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const ROWS = DOCUMENT_SECTIONS.slice(0, 4);
const ESSENTIAL = new Set(["header", "status", "target"]);
const COLUMNS: readonly DataTableColumn<DocumentSection>[] = SECTION_COLUMNS.filter((column): boolean => ESSENTIAL.has(column.id));

// The columns a phone reader needs, the rest a tap away (a row action, or the columns menu).
export function DataTableDo2Example(): React.JSX.Element {
	return <DataTable data={ROWS} columns={COLUMNS} pagination={SECTION_PAGINATION} />;
}
