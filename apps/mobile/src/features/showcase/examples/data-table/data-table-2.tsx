import { DataTable, type DataTableEmptyState, type DataTableFilter } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, STATUS_FILTER, TYPE_FILTER } from "./data-table-sample";

const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER, TYPE_FILTER];
const SEARCH_KEYS: readonly string[] = ["header", "reviewer"];
/** Typing settles for this long before the rows are filtered, so a large table stays responsive. */
const SEARCH_DEBOUNCE_MS = 200;
const PAGE_SIZE = 5;
const EMPTY: DataTableEmptyState = { title: "No sections match", description: "Clear the search or a filter to see more." };

export function DataTable2Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			searchKeys={SEARCH_KEYS}
			searchDebounceMs={SEARCH_DEBOUNCE_MS}
			filters={FILTERS}
			pageSize={PAGE_SIZE}
			title="Document sections"
			description="Search by section or reviewer, then narrow by status and type."
			emptyState={EMPTY}
		/>
	);
}
