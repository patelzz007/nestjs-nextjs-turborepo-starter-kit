"use client";

import * as React from "react";

import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetDraftRow, type SpreadsheetRowStatus } from "@workspace/ui/components/spreadsheet";

import { applyBudgetChanges, BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

const SHOWN_LINE_COUNT = 4;
const LINES: readonly BudgetLine[] = BUDGET_LINES.slice(0, SHOWN_LINE_COUNT);

/** The ids of the lines added here, so each one is marked new. */
const NEW_LINE_PREFIX = "new-";

/** The lines with one empty line added at the end, under an id of its own. */
export function addBudgetLine(lines: readonly BudgetLine[]): readonly BudgetLine[] {
	const line: BudgetLine = { id: `${NEW_LINE_PREFIX}${String(lines.length + 1)}`, item: "", category: "", quantity: 0, unitPrice: 0 };
	return [...lines, line];
}

function getRowStatus(line: BudgetLine): SpreadsheetRowStatus | undefined {
	return line.id.startsWith(NEW_LINE_PREFIX) ? "new" : undefined;
}

/**
 * `draftRow` puts an "add row" button under the last row. What a click creates is the example's business: here an
 * empty line, tinted as new, ready to be typed into.
 */
export function Spreadsheet4Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly BudgetLine[]>(LINES);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<BudgetLine>): void => {
		setLines((current) => applyBudgetChanges(current, change));
	}, []);

	const draftRow = React.useMemo(
		(): SpreadsheetDraftRow => ({
			label: "Add budget line",
			onCreate: (): void => {
				setLines(addBudgetLine);
			},
		}),
		[],
	);

	return <Spreadsheet data={lines} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} onCellsChange={handleCellsChange} draftRow={draftRow} rowStatus={getRowStatus} />;
}
