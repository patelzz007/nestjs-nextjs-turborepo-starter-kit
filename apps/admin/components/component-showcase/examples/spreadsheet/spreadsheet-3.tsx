"use client";

import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetCellStatus, type SpreadsheetRowStatus } from "@workspace/ui/components/spreadsheet";

import { applyBudgetChanges, BUDGET_COLUMNS, BUDGET_LINES, getBudgetLineId, type BudgetLine } from "./spreadsheet-sample";

/** Each marked cell, by `rowId:columnId`. */
type CellMarks = Readonly<Record<string, SpreadsheetCellStatus>>;
const NO_MARKS: CellMarks = {};

function cellKey(rowId: string, columnId: string): string {
	return `${rowId}:${columnId}`;
}

/**
 * The marks after one batch: every written cell is dirty, and every cell whose value was refused as invalid is marked
 * invalid until a good value lands in it. A refusal for being read-only leaves no mark.
 */
export function markCells(marks: CellMarks, change: SpreadsheetCellsChange<BudgetLine>): CellMarks {
	const next: Record<string, SpreadsheetCellStatus> = { ...marks };
	for (const { rowId, columnId } of change.changes) {
		next[cellKey(rowId, columnId)] = "dirty";
	}
	for (const { rowId, columnId, reason } of change.rejected) {
		if (reason === "invalid") {
			next[cellKey(rowId, columnId)] = "invalid";
		}
	}
	return next;
}

/**
 * Type "many" into a Quantity cell: the column's `parse` refuses it, nothing is written, and the cell gets the
 * invalid mark. A good edit gets the dirty mark and tints its row until Save. The grid only draws the marks: what
 * they mean, and when they clear, stays with the example.
 */
export function Spreadsheet3Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly BudgetLine[]>(BUDGET_LINES);
	const [marks, setMarks] = React.useState<CellMarks>(NO_MARKS);
	const markCount = Object.keys(marks).length;

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<BudgetLine>): void => {
		setLines((current) => applyBudgetChanges(current, change));
		setMarks((current) => markCells(current, change));
	}, []);

	const handleSave = React.useCallback((): void => {
		setMarks(NO_MARKS);
	}, []);

	const getCellStatus = React.useCallback((line: BudgetLine, columnId: string): SpreadsheetCellStatus | undefined => marks[cellKey(line.id, columnId)], [marks]);

	const getRowStatus = React.useCallback(
		(line: BudgetLine): SpreadsheetRowStatus | undefined => (Object.keys(marks).some((key) => key.startsWith(`${line.id}:`)) ? "dirty" : undefined),
		[marks],
	);

	return (
		<div className="flex w-full flex-col gap-2">
			<Spreadsheet data={lines} columns={BUDGET_COLUMNS} getRowId={getBudgetLineId} onCellsChange={handleCellsChange} cellStatus={getCellStatus} rowStatus={getRowStatus} />
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
					{markCount === 0 ? "Everything is saved." : `${String(markCount)} marked ${markCount === 1 ? "cell" : "cells"}`}
				</p>
				<Button size="sm" disabled={markCount === 0} onClick={handleSave}>
					Save
				</Button>
			</div>
		</div>
	);
}
