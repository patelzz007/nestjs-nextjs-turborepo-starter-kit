"use client";

import * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import type { DataTableCellScalar } from "@workspace/ui/lib/data-table/prefs";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 5;
const EDITABLE_COLUMNS: string[] = ["header", "target", "limit", "reviewer"];
type EditableField = "header" | "target" | "limit" | "reviewer";

function isEditableField(columnId: string): columnId is EditableField {
	return EDITABLE_COLUMNS.includes(columnId);
}

export function DataTable6Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	// The table reports the column and the row it came from: the edit lands on
	// the record by its id, so it stays right under any sort, filter or page.
	const handleCellEdit = React.useCallback((_rowIndex: number, columnId: string, value: DataTableCellScalar, row: DocumentSection): void => {
		if (!isEditableField(columnId)) {
			return;
		}
		setRows((current) => current.map((item) => (item.id === row.id ? { ...item, [columnId]: String(value) } : item)));
		toastMessage.success({ title: `Updated “${row.header}”`, description: `${columnId} → ${String(value)}` });
	}, []);

	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			editable
			editableColumns={EDITABLE_COLUMNS}
			onCellEdit={handleCellEdit}
			pageSize={PAGE_SIZE}
			title="Inline editing"
			description="Double-click a section, target, limit or reviewer to change it in place."
		/>
	);
}
