"use client";

import type { CellData } from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

import { DataTable, type DataTableCellEdit, type DataTableColumns, type DataTableEditing } from "@workspace/ui/components/data-table";

import {
	DOCUMENT_SECTIONS,
	getSectionId,
	NUMERIC_COLUMN_META,
	parsePageCount,
	SECTION_PAGING,
	SectionStatusBadge,
	withSectionValue,
	type DocumentSection,
} from "./data-table-sample";

/** A section title must say something: the editor stays open with this message until it does. */
export function validateSectionTitle(value: CellData): string | undefined {
	const title = z.string().safeParse(value);
	return title.success && title.data.trim().length > 0 ? undefined : "A section needs a title";
}

// A column is editable when it declares `meta.cellEdit`. `parse` turns the typed text into the column's value and
// returns `undefined` to refuse it, so a page count never becomes text. `validate` checks the parsed value and shows
// its message under the editor.
const COLUMNS: DataTableColumns<DocumentSection> = [
	{ accessorKey: "header", header: "Section", size: 260, meta: { cellEdit: { validate: validateSectionTitle } } },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "limit", header: "Limit", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180, meta: { cellEdit: {} } },
];

/**
 * Double-click a cell, or focus it and press Enter or F2, to edit it in place. Enter commits, Escape cancels. The
 * table never changes the rows itself: it reports the edit and the example writes it. `history` adds Undo and Redo
 * to the toolbar (and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z): each step comes back through `onCellEdit` like any other write.
 */
export function DataTable6Example(): React.JSX.Element {
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const editing = React.useMemo(
		(): DataTableEditing<DocumentSection> => ({
			onCellEdit: (edit: DataTableCellEdit<DocumentSection>): void => {
				setSections((current) => current.map((section) => (section.id === edit.rowId ? withSectionValue(section, edit.columnId, edit.value) : section)));
			},
			history: true,
		}),
		[],
	);

	return <DataTable data={sections} columns={COLUMNS} getRowId={getSectionId} editing={editing} paging={SECTION_PAGING} />;
}
