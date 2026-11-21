"use client";

import type * as React from "react";

import { DataTable, type DataTableLayout } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS } from "./data-table-sample";

const MAX_BODY_HEIGHT = 340;
const LAYOUT: DataTableLayout = { maxHeight: MAX_BODY_HEIGHT, stickyHeader: true };

/**
 * A pin button on every row keeps that row at the top, above the rows that scroll, whatever the sort. Pin a few
 * sections, then sort a column: the pinned rows stay where they are.
 */
export function DataTable24Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} rowPinning layout={LAYOUT} />;
}
