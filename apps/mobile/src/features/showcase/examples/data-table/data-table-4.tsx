import type { DataTableBulkSelectionContext, DataTableCheckboxConfig } from "@workspace/ui-kit-logic";
import { DataTable } from "@workspace/ui-native/components/data-table";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import * as React from "react";

import { useToast } from "../../../toast/facade";
import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;

/** How many rows an action covers: the selected rows, or every matching row once "select all" spans the pages. */
function selectedCount(rows: readonly DocumentSection[], context: DataTableBulkSelectionContext): number {
	return context.selectAllPages ? context.totalMatchingRows : rows.length;
}

export function DataTable4Example(): React.JSX.Element {
	const toast = useToast();
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);
	const checkbox = React.useMemo(
		(): DataTableCheckboxConfig<DocumentSection, LucideIcon> => ({
			bulkActions: [
				{
					key: "mark-done",
					label: "Mark as done",
					icon: CircleCheckIcon,
					onClick: (selected: DocumentSection[], context: DataTableBulkSelectionContext): void => {
						const ids = new Set(selected.map(({ id }): number => id));
						setRows((current): readonly DocumentSection[] =>
							current.map((row): DocumentSection => (context.selectAllPages || ids.has(row.id) ? { ...row, status: "Done" } : row)),
						);
						toast.success(`Marked ${String(selectedCount(selected, context))} as done`);
					},
				},
			],
			onDeleteAll: (selected: DocumentSection[], context: DataTableBulkSelectionContext): void => {
				const ids = new Set(selected.map(({ id }): number => id));
				setRows((current): readonly DocumentSection[] => (context.selectAllPages ? [] : current.filter((row): boolean => !ids.has(row.id))));
				toast.success(`Removed ${String(selectedCount(selected, context))}`);
			},
		}),
		[toast],
	);
	return (
		<DataTable
			data={rows}
			columns={SECTION_COLUMNS}
			checkbox={checkbox}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Bulk selection"
			description="Tick rows, or select every page, then act on them at once."
		/>
	);
}
