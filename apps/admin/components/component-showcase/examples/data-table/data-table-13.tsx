"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls, type DataTableLayout } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS } from "./data-table-sample";

/** The tallest the body grows before it scrolls, in pixels. */
const MAX_BODY_HEIGHT = 320;

/**
 * Every look option at once: compact rows, a tint on every other row, lines between columns, columns sized to their
 * content, and a header that stays in view while the body scrolls (which needs `maxHeight`).
 */
const LAYOUT: DataTableLayout = { density: "compact", striped: true, cellBorders: true, width: "auto", stickyHeader: true, maxHeight: MAX_BODY_HEIGHT };

/** The density menu in the toolbar lets the reader pick compact, comfortable or spacious rows; it starts from `layout.density`. */
const COLUMN_CONTROLS: DataTableColumnControls = { density: true };

export function DataTable13Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} layout={LAYOUT} columnControls={COLUMN_CONTROLS} />;
}
