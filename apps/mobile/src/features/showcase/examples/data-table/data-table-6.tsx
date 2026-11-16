import type { DataTableCellScalar } from "@workspace/ui-kit-logic";
import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { useToast } from "../../../toast/facade";
import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;
const EDITABLE_COLUMNS: readonly string[] = ["header", "target", "limit", "reviewer"];

type EditableField = "header" | "target" | "limit" | "reviewer";

function isEditableField(columnId: string): columnId is EditableField {
	return EDITABLE_COLUMNS.includes(columnId);
}

export function DataTable6Example(): React.JSX.Element {
	const toast = useToast();
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);
	// The table reports the column and the row it came from: the edit lands on
	// the record by its id, so it stays right under any sort, filter or page.
	const handleCellEdit = React.useCallback(
		(_rowIndex: number, columnId: string, value: DataTableCellScalar, row: DocumentSection): void => {
			if (!isEditableField(columnId)) {
				return;
			}
			const text = value === null ? "" : String(value);
			setRows((current): readonly DocumentSection[] => current.map((item): DocumentSection => (item.id === row.id ? { ...item, [columnId]: text } : item)));
			toast.success(`${columnId} is now “${text}”`, { title: `Updated “${row.header}”` });
		},
		[toast],
	);
	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			editable
			editableColumns={EDITABLE_COLUMNS}
			onCellEdit={handleCellEdit}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Inline editing"
			description="Tap a section, target, limit or reviewer to edit it; done saves."
		/>
	);
}
