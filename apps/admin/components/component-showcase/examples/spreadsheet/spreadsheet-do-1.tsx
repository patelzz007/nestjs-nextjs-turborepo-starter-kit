"use client";

import * as React from "react";

import { Spreadsheet, type SpreadsheetCellsChange } from "@workspace/ui/components/spreadsheet";

import { applyBudgetChanges, BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

const SHOWN_LINE_COUNT = 3;
const LINES: readonly BudgetLine[] = BUDGET_LINES.slice(0, SHOWN_LINE_COUNT);

/** Total has no `cellEdit`: it is worked out from Quantity and Unit price, so it follows every edit. */
export function SpreadsheetDo1Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly BudgetLine[]>(LINES);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<BudgetLine>): void => {
		setLines((current) => applyBudgetChanges(current, change));
	}, []);

	return <Spreadsheet data={lines} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} onCellsChange={handleCellsChange} />;
}
