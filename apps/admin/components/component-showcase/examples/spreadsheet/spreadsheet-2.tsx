"use client";

import * as React from "react";

import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetCopy, type SpreadsheetFillHandle, type SpreadsheetSelection } from "@workspace/ui/components/spreadsheet";

import { applyBudgetChanges, BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

/** The handle on the selection's corner: drag it down or across to repeat the selected cells. */
const FILL_HANDLE: SpreadsheetFillHandle = { variant: "square" };

/** How many cells a copy held: its rows times the columns of its first row. */
export function copiedCellCount(copy: SpreadsheetCopy): number {
	const [firstRow] = copy.grid;
	return copy.grid.length * (firstRow?.length ?? 0);
}

/**
 * Select a block, then copy (Ctrl or Cmd + C), cut (X) or paste (V): the clipboard holds tab-separated text, so a
 * block moves to and from any spreadsheet. Delete clears the selection. Drag the fill handle to repeat cells. Each of
 * these is one batch in `onCellsChange`; a read-only cell (Total) refuses the write and the rest still lands.
 */
export function Spreadsheet2Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly BudgetLine[]>(BUDGET_LINES);
	const [selectedCount, setSelectedCount] = React.useState(0);
	const [lastAction, setLastAction] = React.useState("Nothing copied yet");

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<BudgetLine>): void => {
		setLines((current) => applyBudgetChanges(current, change));
		setLastAction(`${change.source}: ${String(change.changes.length)} written, ${String(change.rejected.length)} refused`);
	}, []);

	const handleSelectionChange = React.useCallback((selection: SpreadsheetSelection): void => {
		setSelectedCount(selection.visibleCellCount);
	}, []);

	const handleCopy = React.useCallback((copy: SpreadsheetCopy): void => {
		setLastAction(`${copy.cut ? "cut" : "copy"}: ${String(copiedCellCount(copy))} cells on the clipboard`);
	}, []);

	return (
		<div className="flex w-full flex-col gap-2">
			<Spreadsheet
				data={lines}
				columns={BUDGET_COLUMNS}
				getRowId={getBudgetLineId}
				onCellsChange={handleCellsChange}
				onSelectionChange={handleSelectionChange}
				onCopy={handleCopy}
				fillHandle={FILL_HANDLE}
			/>
			<p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
				{selectedCount} selected · {lastAction}
			</p>
		</div>
	);
}
