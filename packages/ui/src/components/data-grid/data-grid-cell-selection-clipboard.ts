// The cell selection's clipboard (enhancement 8.1: split from data-grid-cell-selection.tsx): TSV and HTML serialisation, parsing, tiling and cell values as text.

import { LIST_SLOT_INDEX, isBigIntPrimitive, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { type DataGridColumn, type DataGridColumnCellEdit, type DataGridCoreTable } from "@workspace/ui/components/data-grid/data-grid";
import type { CellData, RowData } from "@tanstack/react-table";

export const CLIPBOARD_QUOTE_NEEDED = /[\t\n\r"]/;
export const CLIPBOARD_LINE_BREAK = /\r\n|\r|\n/g;

export function serializeDataGridClipboardField(field: string): string {
	// Excel and Sheets quote a field containing a delimiter and double inner
	// quotes; everything else ships bare.
	return CLIPBOARD_QUOTE_NEEDED.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/** Row-major grid → TSV, CRLF rows, Excel-style quoting. */
export function serializeDataGridClipboardText(grid: readonly (readonly string[])[]): string {
	return grid.map((line) => line.map(serializeDataGridClipboardField).join("\t")).join("\r\n");
}

/**
 * TSV → a row-major grid. A stateful scan, not a split: a quoted field may
 * contain tabs, quotes and both newline flavours, which is exactly what Excel
 * emits for a multi-line cell.
 */
export function parseDataGridClipboardText(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	let index = 0;

	while (index < text.length) {
		const char = text.charAt(index);
		if (quoted) {
			if (char === '"') {
				if (text.charAt(index + 1) === '"') {
					field += '"';
					index += 2;
					continue;
				}
				quoted = false;
				index += 1;
				continue;
			}
			field += char;
			index += 1;
			continue;
		}
		if (char === '"' && field === "") {
			quoted = true;
			index += 1;
			continue;
		}
		if (char === "\t") {
			row.push(field);
			field = "";
			index += 1;
			continue;
		}
		if (char === "\r" || char === "\n") {
			if (char === "\r" && text.charAt(index + 1) === "\n") {
				index += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			index += 1;
			continue;
		}
		field += char;
		index += 1;
	}
	row.push(field);
	rows.push(row);

	// Excel terminates the payload with one newline; that final empty line is
	// an artifact of the format, not a data row.
	const last = rows.at(-1);
	if (rows.length > 1 && last?.length === 1 && last.at(LIST_SLOT_INDEX.first) === "") {
		rows.pop();
	}

	return rows;
}

/** Repeats a block cyclically to fill `rowCount` × `columnCount`. */
export function tileDataGridClipboardBlock(block: readonly (readonly string[])[], rowCount: number, columnCount: number): string[][] {
	const tiled: string[][] = [];
	for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
		const source = block.at(rowOffset % Math.max(block.length, 1)) ?? [];
		const line: string[] = [];
		for (let columnOffset = 0; columnOffset < columnCount; columnOffset++) {
			line.push(source.at(columnOffset % Math.max(source.length, 1)) ?? "");
		}
		tiled.push(line);
	}
	return tiled;
}

export function escapeDataGridClipboardHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A minimal text/html flavour alongside the TSV keeps type fidelity when the
 * paste target is Excel or Sheets. Newlines inside a field become `<br>`.
 */
export function renderDataGridClipboardHtml(grid: readonly (readonly string[])[]): string {
	const body = grid.map((line) => `<tr>${line.map((field) => `<td>${escapeDataGridClipboardHtml(field).replace(CLIPBOARD_LINE_BREAK, "<br>")}</td>`).join("")}</tr>`).join("");
	return `<table><tbody>${body}</tbody></table>`;
}

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
		return value.toISOString();
	}
	return toDataGridJson(value) ?? "";
}

/** A column's typed value as clipboard / editor text. */
export function formatDataGridCellValue(cellEdit: DataGridColumnCellEdit | undefined, value: CellData, row: RowData): string {
	const format = cellEdit?.format;
	return format === undefined ? stringifyDataGridCellValue(value) : format(value, row);
}
