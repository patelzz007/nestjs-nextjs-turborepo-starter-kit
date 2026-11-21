"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING } from "./data-table-sample";

const COLUMN_CONTROLS: DataTableColumnControls = { resizing: true };

/**
 * Drag a header's edge to resize its column, or focus the edge and use the arrow keys; the soft dividers in the header
 * mark each edge, and turn into a guide down the table while you drag. Each column starts at its `size`, and the
 * columns share any room left so the table spans its container.
 */
export function DataTable9Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} columnControls={COLUMN_CONTROLS} paging={SECTION_PAGING} />;
}
