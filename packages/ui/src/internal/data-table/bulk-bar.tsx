"use client";

// Everything DataTable derives from the row selection: the "select all N matching rows" banner, the bar of bulk
// actions, and (with mobile cards) the bar that offers "select all" before anything is ticked. It subscribes to the
// selection itself, so ticking a row re-renders this island, never the toolbar or the pager around it.

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatDataTableLabel, type DataTableLabels } from "@workspace/ui-kit-logic";
import { Subscribe, type RowData } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import * as React from "react";

import { TableEngineTableRowSelectAll } from "../table-engine/table-engine-table";
import type { DataTableBulkAction, DataTableBulkSelectionContext, DataTableSelection, DataTableSelectionScope } from "./props";
import { DESTRUCTIVE_OUTLINE_CLASS_NAME, memoGeneric, SELECTION_SURFACE_CLASS_NAME, type DataTableInstance } from "./shared";

/** The key of the built-in "Delete selected" action. */
const DELETE_ACTION_KEY = "delete-selected";

/** The bar's actions: "Delete selected" first when `onDelete` is set, then the caller's own. */
export function resolveBulkActions<TData extends RowData>(selection: DataTableSelection<TData>, labels: DataTableLabels): readonly DataTableBulkAction<TData>[] {
	const actions: DataTableBulkAction<TData>[] = [];
	if (selection.onDelete !== undefined) {
		actions.push({
			key: DELETE_ACTION_KEY,
			label: labels.deleteSelected,
			icon: <Trash2 className="size-4" aria-hidden="true" />,
			tone: "destructive",
			onSelect: selection.onDelete,
		});
	}
	if (selection.bulkActions !== undefined) {
		actions.push(...selection.bulkActions);
	}
	return actions;
}

interface BulkActionButtonProps<TData extends RowData> {
	readonly action: DataTableBulkAction<TData>;
	readonly rows: TData[];
	readonly context: DataTableBulkSelectionContext;
	readonly onDone: () => void;
}

const BulkActionButton = memoGeneric(function BulkActionButton<TData extends RowData>({ action, rows, context, onDone }: BulkActionButtonProps<TData>): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		// The action may be sync or async: the selection clears once it settles.
		void Promise.resolve(action.onSelect(rows, context)).then(onDone);
	}, [action, rows, context, onDone]);

	return (
		<Button variant="outline" size="sm" onClick={handleClick} className={cn("shrink-0 gap-1.5", action.tone === "destructive" ? DESTRUCTIVE_OUTLINE_CLASS_NAME : undefined)}>
			{action.icon}
			{action.label}
		</Button>
	);
});

export interface SelectionIslandProps<TData extends RowData> {
	readonly table: DataTableInstance<TData>;
	readonly selection: DataTableSelection<TData>;
	readonly scope: DataTableSelectionScope;
	readonly onScopeChange: (scope: DataTableSelectionScope) => void;
	/** Every row that matches the filters, across all pages. */
	readonly totalMatchingRows: number;
	/** Whether "select all matching rows" can be offered (a server table needs a way to fetch them). */
	readonly canSelectAllMatching: boolean;
	/** `true` when rows draw as cards: the bar then also offers "select all" before anything is ticked. */
	readonly showSelectAllWhenEmpty: boolean;
	readonly labels: DataTableLabels;
}

function SelectionBars<TData extends RowData>({
	table,
	selection,
	scope,
	onScopeChange,
	totalMatchingRows,
	canSelectAllMatching,
	showSelectAllWhenEmpty,
	labels,
}: SelectionIslandProps<TData>): React.JSX.Element | null {
	const isAllMatching = scope === "all-matching";
	const allPageRowsSelected = table.getIsAllPageRowsSelected();
	const pageRowCount = table.getRowModel().rows.length;

	// Unticking any row leaves "every matching row": the selection is the page's again.
	React.useEffect((): void => {
		if (isAllMatching && !allPageRowsSelected) {
			onScopeChange("page");
		}
	}, [isAllMatching, allPageRowsSelected, onScopeChange]);

	// Read on every render on purpose: the selection lives in the table, and this island renders only when it changes.
	// `flatRows`, not `rows`: in a tree `rows` holds the top level only, and the ticked rows under it would be lost.
	const selectedRows: TData[] = (isAllMatching ? table.getFilteredRowModel().flatRows : table.getFilteredSelectedRowModel().flatRows).map((row) => row.original);
	const context = React.useMemo(
		(): DataTableBulkSelectionContext => ({ scope, totalMatchingRows: isAllMatching ? totalMatchingRows : selectedRows.length }),
		[scope, isAllMatching, totalMatchingRows, selectedRows.length],
	);
	const bulkActions = React.useMemo((): readonly DataTableBulkAction<TData>[] => resolveBulkActions(selection, labels), [selection, labels]);

	const handleSelectAllMatching = React.useCallback((): void => {
		onScopeChange("all-matching");
	}, [onScopeChange]);
	const handleClear = React.useCallback((): void => {
		table.resetRowSelection();
		onScopeChange("page");
	}, [table, onScopeChange]);

	const hasSelection = isAllMatching || selectedRows.length > 0;
	const showBanner = canSelectAllMatching && allPageRowsSelected && pageRowCount > 0 && !isAllMatching && totalMatchingRows > pageRowCount;

	if (!hasSelection && !showSelectAllWhenEmpty) {
		return null;
	}

	const countLabel = isAllMatching
		? formatDataTableLabel(labels.allRowsSelected, { totalCount: totalMatchingRows })
		: selectedRows.length === 0
			? labels.mobileSelectAll
			: selectedRows.length === 1
				? labels.selectedRowCount
				: formatDataTableLabel(labels.selectedRowsCount, { count: selectedRows.length });

	return (
		<>
			{showBanner ? (
				<div className={SELECTION_SURFACE_CLASS_NAME}>
					<p className="text-sm text-muted-foreground">
						{formatDataTableLabel(labels.selectAllPageRowsSelected, { pageCount: pageRowCount })}{" "}
						<Button
							type="button"
							variant="link"
							size="sm"
							onClick={handleSelectAllMatching}
							className="h-auto p-0 font-medium text-foreground underline-offset-4 hover:underline">
							{formatDataTableLabel(labels.selectAllFilteredRows, { totalCount: totalMatchingRows })}
						</Button>
					</p>
				</div>
			) : null}
			<div data-slot="data-table-selection-bar" className={SELECTION_SURFACE_CLASS_NAME}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2">
						<TableEngineTableRowSelectAll />
						<span className="text-sm font-medium text-foreground" aria-live="polite">
							{countLabel}
						</span>
					</div>
					{hasSelection ? (
						<div className="flex flex-wrap items-center gap-2">
							{bulkActions.map((action) => (
								<BulkActionButton key={action.key} action={action} rows={selectedRows} context={context} onDone={handleClear} />
							))}
							<Button variant="ghost" size="sm" onClick={handleClear} className="shrink-0">
								{labels.clearSelection}
							</Button>
						</div>
					) : null}
				</div>
			</div>
		</>
	);
}

/** The selection banner and bars, re-rendered only when the selection changes. */
export const SelectionIsland = memoGeneric(function SelectionIsland<TData extends RowData>(props: SelectionIslandProps<TData>): React.JSX.Element {
	const { table } = props;
	return <Subscribe source={table.atoms.rowSelection}>{() => <SelectionBars {...props} />}</Subscribe>;
});
