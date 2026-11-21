"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING } from "./data-table-sample";

/** `visibility` adds the columns menu to the toolbar; `pinning` adds "pin to start / end" to every header menu. */
const COLUMN_CONTROLS: DataTableColumnControls = { visibility: true, pinning: true };

/**
 * Hide columns from the columns menu, and pin one from its header menu so it stays in view while the rest scroll
 * sideways. The Section column sets `enableHiding: false`, so it can never be hidden.
 */
export function DataTable8Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} columnControls={COLUMN_CONTROLS} paging={SECTION_PAGING} />;
}
