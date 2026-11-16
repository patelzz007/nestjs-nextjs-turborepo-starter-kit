"use client";

import type * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS } from "./data-table-sample";

const PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20];

export function DataTable9Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			pageSize={PAGE_SIZE}
			pageSizeOptions={PAGE_SIZE_OPTIONS}
			sortCycle="asc-desc-none"
			title="Pagination and sorting"
			description="Click a header to sort ascending, descending, then back to the original order; pick how many rows a page shows."
		/>
	);
}
