import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 8;

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** `rows` with the row shown at `from` moved to where the row shown at `to` is. */
export function reorderSections(rows: readonly DocumentSection[], visible: readonly DocumentSection[], from: number, to: number): readonly DocumentSection[] {
	const fromIndex = rows.findIndex((row): boolean => row.id === visible.at(from)?.id);
	const toIndex = rows.findIndex((row): boolean => row.id === visible.at(to)?.id);
	const moved = rows.at(fromIndex);
	if (fromIndex === NOT_FOUND || toIndex === NOT_FOUND || moved === undefined) {
		return rows;
	}
	const rest = rows.filter((row): boolean => row.id !== moved.id);
	return [...rest.slice(0, toIndex), moved, ...rest.slice(toIndex)];
}

export function DataTable7Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);
	// The table passes the rows it shows, in display order: re-anchor by id, never by raw index.
	const handleRowReorder = React.useCallback((fromIndex: number, toIndex: number, visibleRows: DocumentSection[]): void => {
		setRows((current): readonly DocumentSection[] => reorderSections(current, visibleRows, fromIndex, toIndex));
	}, []);
	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			draggable
			onRowReorder={handleRowReorder}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Drag to reorder"
			description="Drag a row by its grip; a screen reader moves it with the grip's actions."
		/>
	);
}
