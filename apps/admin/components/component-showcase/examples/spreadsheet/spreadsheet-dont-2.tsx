"use client";

import type * as React from "react";

import { Spreadsheet } from "@workspace/ui/components/spreadsheet";

import { BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

const SHOWN_LINE_COUNT = 3;
const LINES: readonly BudgetLine[] = BUDGET_LINES.slice(0, SHOWN_LINE_COUNT);

/** The same grid with an unsaved edit and nothing to show for it. */
export function SpreadsheetDont2Example(): React.JSX.Element {
	return <Spreadsheet data={LINES} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} />;
}
