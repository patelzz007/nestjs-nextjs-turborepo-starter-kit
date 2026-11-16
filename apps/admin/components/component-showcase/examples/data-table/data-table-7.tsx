"use client";

import * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 8;

/** `rows` with the row shown at `from` moved to where the row shown at `to` sits: anchored by id, so a sorted or filtered view moves the right record. */
export function reorderSections(rows: readonly DocumentSection[], visible: readonly DocumentSection[], from: number, to: number): readonly DocumentSection[] {
	const fromIndex = rows.findIndex((row) => row.id === visible.at(from)?.id);
	const toIndex = rows.findIndex((row) => row.id === visible.at(to)?.id);
	const moved = rows.at(fromIndex);
	if (fromIndex === -1 || toIndex === -1 || moved === undefined) {
		return rows;
	}
	const rest = rows.filter((row) => row.id !== moved.id);
	return [...rest.slice(0, toIndex), moved, ...rest.slice(toIndex)];
}

export function DataTable7Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	// The table passes the rows it shows, in display order: re-anchor by id, never by raw index.
	const handleRowReorder = React.useCallback((fromIndex: number, toIndex: number, visibleRows: DocumentSection[]): void => {
		setRows((current) => reorderSections(current, visibleRows, fromIndex, toIndex));
	}, []);

	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			draggable
			onRowReorder={handleRowReorder}
			pageSize={PAGE_SIZE}
			title="Drag to reorder"
			description="Drag a row by its grip to a new place. Dragging is pointer-only, so offer move actions for keyboard users."
		/>
	);
}
