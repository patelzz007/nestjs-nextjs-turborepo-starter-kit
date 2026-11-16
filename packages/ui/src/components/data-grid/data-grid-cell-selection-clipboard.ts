// The cell selection's clipboard (enhancement 8.1: split from data-grid-cell-selection.tsx): TSV and HTML serialisation, parsing, tiling and cell values as text.

import { toIsoTimestamp } from "@workspace/ui/lib/format/date-time";
import { isBigIntPrimitive, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import {
	DATA_GRID_CLIPBOARD_LINE_BREAK,
	DATA_GRID_CLIPBOARD_QUOTE_NEEDED,
	escapeDataGridClipboardHtml,
	parseDataGridClipboardText,
	renderDataGridClipboardHtml,
	serializeDataGridClipboardField,
	serializeDataGridClipboardText,
	tileDataGridClipboardBlock,
} from "@workspace/ui-kit-logic";
import { type DataGridColumn, type DataGridColumnCellEdit, type DataGridCoreTable } from "@workspace/ui/components/data-grid/data-grid";
import type { CellData, RowData } from "@tanstack/react-table";

export {
	DATA_GRID_CLIPBOARD_QUOTE_NEEDED as CLIPBOARD_QUOTE_NEEDED,
	DATA_GRID_CLIPBOARD_LINE_BREAK as CLIPBOARD_LINE_BREAK,
	serializeDataGridClipboardField,
	serializeDataGridClipboardText,
	parseDataGridClipboardText,
	tileDataGridClipboardBlock,
	escapeDataGridClipboardHtml,
	renderDataGridClipboardHtml,
};

// ── Selection geometry ─────────────────────────────────────────────────────

/** Columns in render order: the [start, center, end] space `cellSelectionFeature` resolves its bounds against. */
export function getDataGridDisplayOrderedColumns<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

export function isSelectableColumn<TData extends RowData>(column: DataGridColumn<TData>): boolean {
	return column.columnDef.enableCellSelection !== false;
}

/**
 * The column's write contract for one row, or `null` when the cell is
 * read-only. A predicate `editable` is evaluated against `row`; without a
 * row the column counts as writable in principle (the fill preview's coarse
 * column filter).
 */
export function getDataGridWritableCellEdit<TData extends RowData>(column: DataGridColumn<TData>, row?: TData): DataGridColumnCellEdit | null {
	const cellEdit = column.columnDef.meta?.cellEdit;
	if (cellEdit === undefined) {
		return null;
	}
	const { editable } = cellEdit;
	if (editable === undefined || editable === true) {
		return cellEdit;
	}
	if (editable === false) {
		return null;
	}
	return row === undefined || editable(row) ? cellEdit : null;
}

/** `JSON.stringify` honestly typed: it yields `undefined` for functions and symbols. */
export function toDataGridJson(value: CellData): string | undefined {
	return JSON.stringify(value);
}

/**
 * The fallback text of a cell value without a `format`: primitives as
 * themselves, a date as ISO-8601, nothing for null/undefined, and anything
 * else (an object the column did not teach the grid to format) as JSON.
 */
export function stringifyDataGridCellValue(value: CellData): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (isStringPrimitive(value)) {
		return value;
	}
	if (isNumberPrimitive(value) || isBooleanPrimitive(value) || isBigIntPrimitive(value)) {
		return String(value);
	}
	if (value instanceof Date) {
		// Clipboard text: the instant as ISO 8601 (UTC), which spreadsheets read as a date.
		return toIsoTimestamp(value.getTime());
	}
	return toDataGridJson(value) ?? "";
}

/** A column's typed value as clipboard / editor text. */
export function formatDataGridCellValue(cellEdit: DataGridColumnCellEdit | undefined, value: CellData, row: RowData): string {
	const format = cellEdit?.format;
	return format === undefined ? stringifyDataGridCellValue(value) : format(value, row);
}
