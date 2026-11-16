import { DataTable, type DataTableColumn } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const ROWS = DOCUMENT_SECTIONS.slice(0, 4);
const COLUMNS: readonly DataTableColumn<DocumentSection>[] = [
	...SECTION_COLUMNS,
	{ id: "id", header: "Section id", value: (row: DocumentSection): number => row.id },
	{ id: "summary", header: "Summary", width: "lg", value: (row: DocumentSection): string => `${row.type} section by ${row.reviewer}` },
];

// Every field as a column: the reader scrolls sideways and loses which row they are on.
export function DataTableDont2Example(): React.JSX.Element {
	return <DataTable data={ROWS} columns={COLUMNS} pagination={SECTION_PAGINATION} />;
}
