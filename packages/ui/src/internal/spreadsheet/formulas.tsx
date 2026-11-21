"use client";

// Spreadsheet formulas and A1 headers. A cell whose text starts with `=` shows the formula's result; the editor still
// shows the formula. Cells are addressed A1-style by their place on screen: columns left to right (A, B, …), rows top
// to bottom (1, 2, …). The caller's data keeps the formula text: nothing here writes a row.

import { isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import {
	createSpreadsheetEvaluator,
	formatSpreadsheetCellRef,
	formatSpreadsheetValue,
	isSpreadsheetFormula,
	shiftSpreadsheetFormula,
	spreadsheetColumnLetters,
	type SpreadsheetCellInput,
	type SpreadsheetValue,
} from "@workspace/ui-kit-logic";
import { flexRender, type CellContext, type CellData, type ColumnDef, type RowData } from "@tanstack/react-table";
import * as React from "react";

import type { TableEngineCoreTable, TableEngineFeatures } from "../table-engine/table-engine";

/** The id of the row-number column A1 headers add. Never a caller's column id. */
export const SPREADSHEET_ROW_NUMBER_COLUMN_ID = "spreadsheet-row-number";

const ROW_NUMBER_COLUMN_SIZE_PX = 48;

/** A cell's content as the formula engine reads it: a number, text, a boolean, or `null` for anything else. */
export function toSpreadsheetCellInput(value: CellData): SpreadsheetCellInput {
	if (isNumberPrimitive(value) || isStringPrimitive(value) || isBooleanPrimitive(value)) {
		return value;
	}
	return null;
}

/** Where each row and column sits on screen, so a cell can be read by its A1 address and an address found for a cell. */
export interface SpreadsheetGrid {
	/** The value a formula cell shows, or `null` for a cell that holds no formula. */
	readonly formulaValueOf: (rowId: string, columnId: string) => SpreadsheetValue | null;
	/** A cell's A1 address (`B3`), or `null` for a cell that is not on the grid (the row-number column). */
	readonly addressOf: (rowId: string, columnId: string) => string | null;
}

/** The grid of one state of the table: rows in display order, data columns left to right. */
export function createSpreadsheetGrid<TData extends RowData>(table: TableEngineCoreTable<TData>): SpreadsheetGrid {
	const rows = table.getRowModel().rows;
	const columns = table.getVisibleLeafColumns().filter((column) => column.id !== SPREADSHEET_ROW_NUMBER_COLUMN_ID);
	const rowIndex = new Map(rows.map((row, index) => [row.id, index]));
	const columnIndex = new Map(columns.map((column, index) => [column.id, index]));

	const evaluator = createSpreadsheetEvaluator((ref) => {
		const row = rows.at(ref.row);
		const column = columns.at(ref.column);
		return row === undefined || column === undefined ? null : toSpreadsheetCellInput(row.getValue(column.id));
	});

	return {
		formulaValueOf: (rowId, columnId): SpreadsheetValue | null => {
			const row = rowIndex.get(rowId);
			const column = columnIndex.get(columnId);
			if (row === undefined || column === undefined) {
				return null;
			}
			const input = toSpreadsheetCellInput(rows.at(row)?.getValue(columnId) ?? null);
			return isStringPrimitive(input) && isSpreadsheetFormula(input) ? evaluator.valueOf({ column, row }) : null;
		},
		addressOf: (rowId, columnId): string | null => {
			const row = rowIndex.get(rowId);
			const column = columnIndex.get(columnId);
			return row === undefined || column === undefined ? null : formatSpreadsheetCellRef({ column, row });
		},
	};
}

const SpreadsheetGridContext = React.createContext<SpreadsheetGrid | null>(null);

export const SpreadsheetGridProvider = SpreadsheetGridContext.Provider;

/** A formula cell's result, an error in the destructive colour, or the column's own rendering for any other cell. */
function FormulaAwareCell<TData extends RowData>({
	context,
	render,
}: {
	readonly context: CellContext<TableEngineFeatures, TData>;
	readonly render: ColumnDef<TableEngineFeatures, TData>["cell"];
}): React.ReactNode {
	const grid = React.useContext(SpreadsheetGridContext);
	const value = grid?.formulaValueOf(context.row.id, context.column.id) ?? null;
	if (value === null) {
		return render === undefined ? String(toSpreadsheetCellInput(context.getValue()) ?? "") : flexRender(render, context);
	}
	return (
		<span
			data-slot="spreadsheet-formula-value"
			data-error={value.kind === "error" ? true : undefined}
			className={cn(value.kind === "error" ? "font-medium text-destructive" : undefined)}>
			{formatSpreadsheetValue(value)}
		</span>
	);
}

/** Fill carries a formula to another cell by moving its relative references; other values are copied as they are. */
function carryFormula(value: CellData, rowOffset: number, columnOffset: number): CellData {
	return isStringPrimitive(value) ? shiftSpreadsheetFormula(value, rowOffset, columnOffset) : value;
}

/** The caller's columns with formula-aware cells, and (when writable) a fill that moves formula references. */
export function withSpreadsheetFormulas<TData extends RowData>(columns: readonly ColumnDef<TableEngineFeatures, TData>[]): ColumnDef<TableEngineFeatures, TData>[] {
	return columns.map((column): ColumnDef<TableEngineFeatures, TData> => {
		if ("columns" in column) {
			return { ...column, columns: withSpreadsheetFormulas(column.columns) };
		}
		const render = column.cell;
		const cellEdit = column.meta?.cellEdit;
		const formulaAware: ColumnDef<TableEngineFeatures, TData> = { ...column, cell: (context): React.ReactNode => <FormulaAwareCell context={context} render={render} /> };
		// A writable column that has no carrier of its own moves formula references when fill carries them.
		return cellEdit === undefined || cellEdit.carry !== undefined
			? formulaAware
			: { ...formulaAware, meta: { ...column.meta, cellEdit: { ...cellEdit, carry: carryFormula } } };
	});
}

/** A1 headers: every data column titled by its letter (its own title kept for menus and the editor), and a row-number column in front. */
export function withSpreadsheetA1Headers<TData extends RowData>(columns: readonly ColumnDef<TableEngineFeatures, TData>[]): ColumnDef<TableEngineFeatures, TData>[] {
	let leafIndex = 0;
	const letter = (column: ColumnDef<TableEngineFeatures, TData>): ColumnDef<TableEngineFeatures, TData> => {
		if ("columns" in column) {
			return { ...column, columns: column.columns.map(letter) };
		}
		const letters = spreadsheetColumnLetters(leafIndex);
		leafIndex += 1;
		const title = column.meta?.headerTitle ?? (isStringPrimitive(column.header) ? column.header : letters);
		return { ...column, header: letters, meta: { ...column.meta, headerTitle: title } };
	};
	const lettered = columns.map(letter);
	const rowNumbers: ColumnDef<TableEngineFeatures, TData> = {
		id: SPREADSHEET_ROW_NUMBER_COLUMN_ID,
		header: "",
		cell: ({ row, table }): string => String(table.getRowModel().rows.findIndex((candidate) => candidate.id === row.id) + 1),
		size: ROW_NUMBER_COLUMN_SIZE_PX,
		enableSorting: false,
		enableResizing: false,
		enableCellSelection: false,
		meta: { headerClassName: "bg-muted", cellClassName: "bg-muted text-center text-xs text-muted-foreground tabular-nums" },
	};
	return [rowNumbers, ...lettered];
}

/** The bar above an A1 grid: the focused cell's address, and what the cell holds (its formula, not the result). */
export function SpreadsheetFormulaBar({ address, content, label }: { readonly address: string; readonly content: string; readonly label: string }): React.JSX.Element {
	return (
		<div data-slot="spreadsheet-formula-bar" className="flex items-center gap-2 border-b px-2 py-1 text-sm">
			<output aria-label={label} className="w-16 shrink-0 rounded-sm bg-muted px-2 py-0.5 text-center font-mono text-xs tabular-nums">
				{address}
			</output>
			<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{content}</span>
		</div>
	);
}
