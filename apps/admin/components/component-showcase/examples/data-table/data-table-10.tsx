"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING } from "./data-table-sample";

const COLUMN_CONTROLS: DataTableColumnControls = { reordering: true };

/** Open a header's menu and move the column one place towards the start or the end. */
export function DataTable10Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} columnControls={COLUMN_CONTROLS} paging={SECTION_PAGING} />;
}
