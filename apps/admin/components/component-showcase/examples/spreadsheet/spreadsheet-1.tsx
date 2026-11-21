"use client";

import * as React from "react";

import { Spreadsheet, type SpreadsheetCellsChange } from "@workspace/ui/components/spreadsheet";

import { applyBudgetChanges, BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

/**
 * A grid of cells. Click a cell and move with the arrow keys; drag, or hold Shift, to select a block. Type, press
 * Enter or F2, or double-click to edit; Enter commits and moves down. The grid never changes the rows itself: every
 * write arrives in `onCellsChange` and the example applies it.
 */
export function Spreadsheet1Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly BudgetLine[]>(BUDGET_LINES);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<BudgetLine>): void => {
		setLines((current) => applyBudgetChanges(current, change));
	}, []);

	return <Spreadsheet data={lines} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} onCellsChange={handleCellsChange} />;
}
