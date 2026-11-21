"use client";

import type * as React from "react";

import { Spreadsheet, type SpreadsheetCellStatus, type SpreadsheetRowStatus } from "@workspace/ui/components/spreadsheet";

import { BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

const SHOWN_LINE_COUNT = 3;
const LINES: readonly BudgetLine[] = BUDGET_LINES.slice(0, SHOWN_LINE_COUNT);

/** The one cell this sample treats as edited and not yet saved. */
const EDITED_ROW_ID = "b-2";
const EDITED_COLUMN_ID = "quantity";

function getCellStatus(line: BudgetLine, columnId: string): SpreadsheetCellStatus | undefined {
	return line.id === EDITED_ROW_ID && columnId === EDITED_COLUMN_ID ? "dirty" : undefined;
}

function getRowStatus(line: BudgetLine): SpreadsheetRowStatus | undefined {
	return line.id === EDITED_ROW_ID ? "dirty" : undefined;
}

/** The unsaved cell carries a mark and its row a tint, so the reader sees what a save will write. */
export function SpreadsheetDo2Example(): React.JSX.Element {
	return <Spreadsheet data={LINES} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} cellStatus={getCellStatus} rowStatus={getRowStatus} />;
}
