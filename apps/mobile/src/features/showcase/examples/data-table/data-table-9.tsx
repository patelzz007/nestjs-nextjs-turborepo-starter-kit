import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20];

export function DataTable9Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			pageSizeOptions={PAGE_SIZE_OPTIONS}
			sortCycle="asc-desc-none"
			title="Pagination and sorting"
			description="Tap a header to sort ascending, descending, then back to the original order; pick how many rows a page shows."
		/>
	);
}
