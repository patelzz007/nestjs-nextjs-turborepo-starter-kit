"use client";

import { CircleCheck } from "lucide-react";
import * as React from "react";

import { DataTable, type DataTableBulkSelectionContext, type DataTableCheckboxConfig } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 5;

/** How many rows an action covers: the selected rows, or every matching row once "select all" spans pages. */
function selectedCount(rows: readonly DocumentSection[], context: DataTableBulkSelectionContext): number {
	return context.selectAllPages ? context.totalMatchingRows : rows.length;
}

export function DataTable4Example(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const checkbox = React.useMemo(
		(): DataTableCheckboxConfig<DocumentSection> => ({
			bulkActions: [
				{
					key: "mark-done",
					label: "Mark as done",
					icon: <CircleCheck />,
					onClick: (selected, context) => {
						const ids = new Set(selected.map(({ id }) => id));
						setRows((current) => current.map((row) => (context.selectAllPages || ids.has(row.id) ? { ...row, status: "Done" } : row)));
						toastMessage.success({ title: `Marked ${String(selectedCount(selected, context))} as done` });
					},
				},
			],
			onDeleteAll: (selected, context) => {
				const ids = new Set(selected.map(({ id }) => id));
				setRows((current) => (context.selectAllPages ? [] : current.filter((row) => !ids.has(row.id))));
				toastMessage.success({ title: `Removed ${String(selectedCount(selected, context))}` });
			},
		}),
		[],
	);

	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			checkbox={checkbox}
			pageSize={PAGE_SIZE}
			title="Bulk selection"
			description="Tick rows, or select every page, then act on them at once."
		/>
	);
}
