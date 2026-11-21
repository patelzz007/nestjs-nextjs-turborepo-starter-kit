// The cell selection's clipboard (enhancement 8.1: split from cell-selection.tsx): TSV and HTML serialisation, parsing, tiling and cell values as text.

import { toIsoTimestamp } from "@workspace/ui/lib/format/date-time";
import { isBigIntPrimitive, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import {
	escapeTableEngineClipboardHtml,
	parseTableEngineClipboardText,
	renderTableEngineClipboardHtml,
	serializeTableEngineClipboardField,
	serializeTableEngineClipboardText,
	tileTableEngineClipboardBlock,
} from "@workspace/ui-kit-logic";
import { type TableEngineColumn, type TableEngineColumnCellEdit, type TableEngineCoreTable } from "../table-engine/table-engine";
import type { CellData, RowData } from "@tanstack/react-table";

export {
	serializeTableEngineClipboardField,
	serializeTableEngineClipboardText,
	parseTableEngineClipboardText,
	tileTableEngineClipboardBlock,
	escapeTableEngineClipboardHtml,
	renderTableEngineClipboardHtml,
};

// ── Selection geometry ─────────────────────────────────────────────────────

/** Columns in render order: the [start, center, end] space `cellSelectionFeature` resolves its bounds against. */
export function getTableEngineDisplayOrderedColumns<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

export function isSelectableColumn<TData extends RowData>(column: TableEngineColumn<TData>): boolean {
	return column.columnDef.enableCellSelection !== false;
}

/**
 * The column's write contract for one row, or `null` when the cell is
 * read-only. A predicate `editable` is evaluated against `row`; without a
 * row the column counts as writable in principle (the fill preview's coarse
 * column filter).
 */
export function getTableEngineWritableCellEdit<TData extends RowData>(column: TableEngineColumn<TData>, row?: TData): TableEngineColumnCellEdit | null {
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
export function toTableEngineJson(value: CellData): string | undefined {
	return JSON.stringify(value);
}

/**
 * The fallback text of a cell value without a `format`: primitives as
 * themselves, a date as ISO-8601, nothing for null/undefined, and anything
 * else (an object the column did not teach the grid to format) as JSON.
 */
export function stringifyTableEngineCellValue(value: CellData): string {
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
	return toTableEngineJson(value) ?? "";
}

/** A column's typed value as clipboard / editor text. */
export function formatTableEngineCellValue(cellEdit: TableEngineColumnCellEdit | undefined, value: CellData, row: RowData): string {
	const format = cellEdit?.format;
	return format === undefined ? stringifyTableEngineCellValue(value) : format(value, row);
}
