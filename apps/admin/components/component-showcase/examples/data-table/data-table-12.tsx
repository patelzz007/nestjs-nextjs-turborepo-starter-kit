"use client";

import type * as React from "react";

import { DataTable, type DataTablePaging, type DataTableSortingOptions } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS } from "./data-table-sample";

const PAGE_SIZE = 4;
/** The rows per page to start with, and the sizes the reader can pick. */
const PAGING: DataTablePaging = { pageSize: PAGE_SIZE, pageSizeOptions: [PAGE_SIZE, 8, 20] };

/**
 * `initial` is the sort the table opens with (largest target first). `asc-desc-none` returns to the given order on
 * the third click; the default, `asc-desc`, flips between the two.
 */
const SORTING: DataTableSortingOptions = { initial: [{ id: "target", desc: true }], cycle: "asc-desc-none" };

/** The pager shows the range, the page buttons and the page size. A change of sort or size returns to page one. */
export function DataTable12Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} paging={PAGING} sorting={SORTING} />;
}
