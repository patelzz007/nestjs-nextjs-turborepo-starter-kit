import type { DataTableClientPagination } from "@workspace/ui-kit-logic";
import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

/** Enough rows that drawing them all would be slow; the table draws only the ones in view. */
const ROW_COUNT = 2000;
/** The scrolling body's height, in points. */
const MAX_HEIGHT = 420;
const SEARCH_KEYS: readonly string[] = ["header"];

/** The sample sections repeated into `ROW_COUNT` numbered rows. */
const MANY_SECTIONS: readonly DocumentSection[] = Array.from({ length: ROW_COUNT }, (_, position: number): DocumentSection => {
	const base = DOCUMENT_SECTIONS.at(position % DOCUMENT_SECTIONS.length) ?? DOCUMENT_SECTIONS.at(0);
	if (base === undefined) {
		throw new Error("the sample has at least one section");
	}
	return { ...base, id: position + 1, header: `${base.header} #${String(position + 1)}` };
});

const PAGINATION: DataTableClientPagination<DocumentSection> = { mode: "client", getRowId: (row: DocumentSection): string => String(row.id) };

export function DataTable12Example(): React.JSX.Element {
	return (
		<DataTable
			data={MANY_SECTIONS}
			columns={SECTION_COLUMNS}
			searchKeys={SEARCH_KEYS}
			virtualizeRows
			maxHeight={MAX_HEIGHT}
			pagination={PAGINATION}
			pageSize={ROW_COUNT}
			title="Virtualised rows"
			description="Two thousand rows in one scrolling body: only the rows in view are drawn."
		/>
	);
}
