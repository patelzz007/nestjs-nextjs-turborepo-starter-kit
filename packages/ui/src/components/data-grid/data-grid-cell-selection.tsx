"use client";

// ============================================================
// components/data-grid/data-grid-cell-selection.tsx
//
// The spreadsheet layer of the data grid: a headless controller that adds
// keyboard navigation, clipboard copy / cut / paste (TSV + HTML), clear,
// type-to-edit, a built-in free-text editor and the fill-handle drag to a
// grid whose `tableLayout.cellSelection` is on. Mount it once inside
// `<DataGrid>`, next to the table. Selection state itself is TanStack v9's
// `cellSelectionFeature` (registered by `dataGridFeatures`); this module
// never owns data — every write reaches the consumer as ONE
// `onCellsChange` batch per operation.
//
// The listeners attach to the grid's own body viewport, whose table receives
// DOM focus (the container-focus model with `aria-activedescendant`), so a
// virtualized row unmounting can never strand `document.activeElement`.
// ============================================================

import { hasGlobalConstructor, isBigIntPrimitive, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive, LIST_SLOT_INDEX } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import {
	DATA_GRID_PINNED_CELL_Z_INDEX,
	getColumnHeaderLabel,
	useDataGrid,
	useDataGridAtom,
	type DataGridCell,
	type DataGridCellAddress,
	type DataGridCellChange,
	type DataGridCellEditorControl,
	type DataGridCellEditRequest,
	type DataGridCellRejection,
	type DataGridCellSelectionBound,
	type DataGridCellsChangeDetails,
	type DataGridColumn,
	type DataGridColumnCellEdit,
	type DataGridCoreTable,
	type DataGridFeatures,
	type DataGridGridVisitor,
	type DataGridLayoutProps,
	type DataGridTypedGrid,
} from "@workspace/ui/components/data-grid/data-grid";
import { cn } from "@workspace/ui/lib/core/utils";
import type { CellData, CellSelectionBounds, Row, RowData } from "@tanstack/react-table";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { createPortal } from "react-dom";
import { z } from "zod";

// ── Constants ──────────────────────────────────────────────────────────────

/** Gesture outlines and the editor sit above sticky pinned cells, below the sticky header (z-40). */
const DATA_GRID_GESTURE_LAYER_OFFSET = 5;
const DATA_GRID_GESTURE_Z_INDEX = DATA_GRID_PINNED_CELL_Z_INDEX + DATA_GRID_GESTURE_LAYER_OFFSET;

/** How often, and how far apart, `focusCell` retries while a freshly created row mounts. */
const FOCUS_RETRY_ATTEMPTS = 12;
const FOCUS_RETRY_DELAY_MS = 32;

/** PageUp/PageDown step when nothing is measurable (jsdom, a collapsed grid). */
const PAGE_JUMP_FALLBACK_ROWS = 10;

/** Line-height fallbacks for the editor overlay when the cell's computed style is `normal`. */
const LINE_HEIGHT_FONT_RATIO = 1.5;
const DEFAULT_LINE_HEIGHT_PX = 20;

/** Half of a length: centring math (a row's middle, a centred line). */
const HALF = 0.5;

/** A printable key reports one character in `KeyboardEvent.key`. */
const PRINTABLE_KEY_LENGTH = 1;

const ROW_SELECTOR = "tbody tr[data-row-id]";
const FOCUSED_CELL_SELECTOR = "td[data-cell-focused]";
const GRID_TABLE_SELECTOR = 'table[data-slot="data-grid-table"]';

// ── Types ──────────────────────────────────────────────────────────────────

/** A one-step direction in the grid. */
type DataGridStepDirection = "up" | "down" | "left" | "right";

/** Where a finished edit sends the focused cell, or `null` to stay. */
type DataGridEditorAdvance = DataGridStepDirection | null;

export interface DataGridFocusCellOptions {
	/** Also open the cell's editor, the way Enter would. */
	readonly edit?: boolean;
}

/** Imperative surface of the cell-selection controller. */
export interface DataGridCellSelectionApi {
	/**
	 * Moves the grid's cell focus AND the document focus together, retrying
	 * briefly while the row mounts, so a freshly created row is typeable
	 * without an extra click. `edit: true` also opens the cell's editor.
	 */
	readonly focusCell: (rowId: string, columnId: string, options?: DataGridFocusCellOptions) => void;
	/** Clears every range and the focused cell. */
	readonly clearSelection: () => void;
	/** Scrolls a rendered cell into view without moving focus. */
	readonly scrollToCell: (rowId: string, columnId: string) => void;
}

/** One open built-in editor: which cell, which control, and its text. */
interface DataGridEditorSession {
	readonly rowId: string;
	readonly columnId: string;
	readonly control: DataGridCellEditorControl;
	/** What the editor opens with: the typed seed or the formatted value. */
	readonly initialValue: string;
	/** The formatted current value; an unchanged commit dispatches nothing. */
	readonly baseline: string;
	/** Accessible name of the overlay control, from the column's header. */
	readonly label: string;
}

/** The region a paste wrote, in display indexes. */
export interface DataGridPasteTarget {
	/** Display indexes of the pasted region's first and last row. */
	readonly startRowIndex: number;
	readonly endRowIndex: number;
	/** How many rows a paste actually wrote (hidden rows are skipped). */
	readonly rowCount?: number;
	/** Display indexes of the pasted region's first and last column. */
	readonly startColumnIndex: number;
	readonly endColumnIndex: number;
}

/** What `buildDataGridPasteDetails` returns: the batch and the region it covers. */
export interface DataGridPasteResult<TData> {
	readonly details: DataGridCellsChangeDetails<TData>;
	readonly target: DataGridPasteTarget;
}

/** What one clipboard write produced. */
interface DataGridClipboardWrite {
	readonly text: string;
	readonly grid: string[][];
}

// ── Clipboard text: pure ───────────────────────────────────────────────────

const CLIPBOARD_QUOTE_NEEDED = /[\t\n\r"]/;
const CLIPBOARD_LINE_BREAK = /\r\n|\r|\n/g;

function serializeDataGridClipboardField(field: string): string {
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

function escapeDataGridClipboardHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A minimal text/html flavour alongside the TSV keeps type fidelity when the
 * paste target is Excel or Sheets. Newlines inside a field become `<br>`.
 */
function renderDataGridClipboardHtml(grid: readonly (readonly string[])[]): string {
	const body = grid.map((line) => `<tr>${line.map((field) => `<td>${escapeDataGridClipboardHtml(field).replace(CLIPBOARD_LINE_BREAK, "<br>")}</td>`).join("")}</tr>`).join("");
	return `<table><tbody>${body}</tbody></table>`;
}

// ── Selection geometry ─────────────────────────────────────────────────────

/** Columns in render order: the [start, center, end] space `cellSelectionFeature` resolves its bounds against. */
function getDataGridDisplayOrderedColumns<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridColumn<TData>[] {
	return [...table.getStartVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getEndVisibleLeafColumns()];
}

function isSelectableColumn<TData extends RowData>(column: DataGridColumn<TData>): boolean {
	return column.columnDef.enableCellSelection !== false;
}

/**
 * The column's write contract for one row, or `null` when the cell is
 * read-only. A predicate `editable` is evaluated against `row`; without a
 * row the column counts as writable in principle (the fill preview's coarse
 * column filter).
 */
function getDataGridWritableCellEdit<TData extends RowData>(column: DataGridColumn<TData>, row?: TData): DataGridColumnCellEdit | null {
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
function toDataGridJson(value: CellData): string | undefined {
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
function formatDataGridCellValue(cellEdit: DataGridColumnCellEdit | undefined, value: CellData, row: RowData): string {
	const format = cellEdit?.format;
	return format === undefined ? stringifyDataGridCellValue(value) : format(value, row);
}

/** The ids of the data rows the body currently renders, in DOM order. */
function getDataGridDomRowIds(viewport: HTMLElement): string[] {
	const ids: string[] = [];
	for (const rowElement of viewport.querySelectorAll(ROW_SELECTOR)) {
		const id = rowElement.getAttribute("data-row-id");
		if (id !== null && id !== "") {
			ids.push(id);
		}
	}
	return ids;
}

/** The rendered `<tr>` of a row, matched by attribute value (no selector escaping needed). */
function findDataGridRowElement(viewport: HTMLElement, rowId: string): HTMLTableRowElement | null {
	for (const rowElement of viewport.querySelectorAll<HTMLTableRowElement>(ROW_SELECTOR)) {
		if (rowElement.getAttribute("data-row-id") === rowId) {
			return rowElement;
		}
	}
	return null;
}

/** The rendered `<td>` of a cell. */
function findDataGridCellElement(viewport: HTMLElement, rowId: string, columnId: string): HTMLTableCellElement | null {
	const rowElement = findDataGridRowElement(viewport, rowId);
	if (rowElement === null) {
		return null;
	}
	for (const cellElement of rowElement.querySelectorAll<HTMLTableCellElement>("td[data-col-id]")) {
		if (cellElement.getAttribute("data-col-id") === columnId) {
			return cellElement;
		}
	}
	return null;
}

/**
 * Ids of the rows the view can actually show: the page slice plus rows the
 * DOM renders outside it (pinned rows). Selection bounds live in
 * pre-paginated display order, so every batch walk filters rows through this
 * set — the cells a batch touches are exactly the cells the selection paints.
 * `null` when no row can be off-page (no viewport, or the page slice covers
 * the whole display order).
 */
function getDataGridRenderedRowIds<TData extends RowData>(table: DataGridCoreTable<TData>, viewport: HTMLElement | null | undefined): Set<string> | null {
	if (viewport === null || viewport === undefined) {
		return null;
	}
	const pageRows = table.getRowModel().rows;
	if (pageRows.length === table.getRowsInDisplayOrder().length) {
		return null;
	}
	const rendered = new Set<string>(pageRows.map((row) => row.id));
	for (const id of getDataGridDomRowIds(viewport)) {
		rendered.add(id);
	}
	return rendered;
}

function isRenderedRow(rendered: Set<string> | null, rowId: string): boolean {
	return rendered === null || rendered.has(rowId);
}

/**
 * Cells of the current selection the view can show, under the same row
 * filter the batch builders use, so a count next to the selection always
 * matches what is painted and what a batch will touch.
 */
export function getDataGridVisibleSelectedCellCount<TData extends RowData>(table: DataGridCoreTable<TData>, viewport: HTMLElement | null): number {
	const bounds = table.getCellSelectionBounds();
	if (bounds.length === 0) {
		return 0;
	}
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const rendered = getDataGridRenderedRowIds(table, viewport);
	let count = 0;
	for (const bound of bounds) {
		let rowCount = 0;
		for (let rowIndex = bound.minRowIndex; rowIndex <= bound.maxRowIndex; rowIndex++) {
			const row = rows.at(rowIndex);
			if (row !== undefined && isRenderedRow(rendered, row.id)) {
				rowCount += 1;
			}
		}
		let columnCount = 0;
		for (let columnIndex = bound.minColumnIndex; columnIndex <= bound.maxColumnIndex; columnIndex++) {
			const column = columns.at(columnIndex);
			if (column !== undefined && isSelectableColumn(column)) {
				columnCount += 1;
			}
		}
		count += rowCount * columnCount;
	}
	return count;
}

function boundContains(bound: CellSelectionBounds, rowIndex: number, columnIndex: number): boolean {
	return rowIndex >= bound.minRowIndex && rowIndex <= bound.maxRowIndex && columnIndex >= bound.minColumnIndex && columnIndex <= bound.maxColumnIndex;
}

/**
 * The bound of the ACTIVE (most recent) region: the one containing the
 * focused cell (the newest range's anchor), falling back to the geometric
 * last when the newest range was an exclude.
 */
function getDataGridActiveBound<TData extends RowData>(table: DataGridCoreTable<TData>): CellSelectionBounds | null {
	const bounds = table.getCellSelectionBounds();
	if (bounds.length === 0) {
		return null;
	}
	const focused = table.getFocusedCell();
	if (focused !== undefined) {
		const rowIndex = focused.row.getDisplayIndex();
		const columnIndex = getDataGridDisplayOrderedColumns(table).findIndex((column) => column.id === focused.column.id);
		const containing = bounds.find((bound) => boundContains(bound, rowIndex, columnIndex));
		if (containing !== undefined) {
			return containing;
		}
	}
	return bounds.at(-1) ?? null;
}

/** The step outcome: the target cell, the grid boundary, or `null` when the position is not resolvable here. */
type DataGridStepTarget = DataGridCellAddress | "edge" | null;

/**
 * The cell one visual step away: selectable columns horizontally, RENDERED
 * row order vertically, so navigation crosses pinned rows and pagination
 * windows the feature's own move cannot resolve.
 */
function getDataGridStepTarget<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	viewport: HTMLElement,
	from: DataGridCellAddress,
	direction: DataGridStepDirection,
): DataGridStepTarget {
	if (direction === "left" || direction === "right") {
		const selectable = getDataGridDisplayOrderedColumns(table).filter((column) => isSelectableColumn(column));
		const index = selectable.findIndex((column) => column.id === from.columnId);
		if (index === -1) {
			return null;
		}
		const next = selectable.at(index + (direction === "right" ? 1 : -1));
		return next === undefined || index + (direction === "right" ? 1 : -1) < 0 ? "edge" : { rowId: from.rowId, columnId: next.id };
	}
	const renderedIds = getDataGridDomRowIds(viewport);
	const index = renderedIds.indexOf(from.rowId);
	if (index === -1) {
		return null;
	}
	const nextIndex = index + (direction === "down" ? 1 : -1);
	const nextId = nextIndex < 0 ? undefined : renderedIds.at(nextIndex);
	return nextId === undefined ? "edge" : { rowId: nextId, columnId: from.columnId };
}

/** The active range's corner opposite the focused anchor: where a Shift-extend grows from. */
function getDataGridActiveCorner<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridCellAddress | null {
	const focused = table.getFocusedCell();
	if (focused === undefined) {
		return null;
	}
	const bound = getDataGridActiveBound(table);
	if (bound === null) {
		return null;
	}
	const rows = table.getRowsInDisplayOrder();
	const allColumns = getDataGridDisplayOrderedColumns(table);
	const rowIndex = focused.row.getDisplayIndex();
	const columnIndex = allColumns.findIndex((column) => column.id === focused.column.id);
	return {
		rowId: rows.at(rowIndex === bound.minRowIndex ? bound.maxRowIndex : bound.minRowIndex)?.id ?? focused.row.id,
		columnId: allColumns.at(columnIndex === bound.minColumnIndex ? bound.maxColumnIndex : bound.minColumnIndex)?.id ?? focused.column.id,
	};
}

function getDataGridBoundKey<TData extends RowData>(table: DataGridCoreTable<TData>): string {
	const bounds = table.getCellSelectionBounds();
	const bound = bounds.at(-1);
	return bound === undefined
		? "none"
		: `${String(bounds.length)}:${String(bound.minRowIndex)}-${String(bound.maxRowIndex)}:${String(bound.minColumnIndex)}-${String(bound.maxColumnIndex)}`;
}

/**
 * Shift+Arrow: the feature keeps focus on the anchor and grows the range from
 * its active corner. When its own extend cannot resolve the step (a pinned
 * row), re-derive the corner from the bounds and step it in visual space.
 * Returns the corner the view should follow.
 */
function extendDataGridSelection<TData extends RowData>(table: DataGridCoreTable<TData>, viewport: HTMLElement, direction: DataGridStepDirection): DataGridCellAddress | null {
	const before = getDataGridBoundKey(table);
	table.extendCellSelection(direction);
	if (getDataGridBoundKey(table) !== before) {
		return getDataGridActiveCorner(table);
	}
	const focused = table.getFocusedCell();
	if (focused === undefined) {
		return null;
	}
	const active = getDataGridActiveCorner(table) ?? { rowId: focused.row.id, columnId: focused.column.id };
	const target = getDataGridStepTarget(table, viewport, active, direction);
	if (target === null || target === "edge") {
		return null;
	}
	table.selectCellRange({ anchorRowId: focused.row.id, anchorColumnId: focused.column.id, focusRowId: target.rowId, focusColumnId: target.columnId }, { mode: "replace" });
	return target;
}

/**
 * The active region as formatted strings, row-major. Columns opted out of
 * selection are compacted away and rows the view cannot show are skipped
 * when a viewport is given. `null` when nothing is selected.
 */
export function getDataGridActiveRegionGrid<TData extends RowData>(table: DataGridCoreTable<TData>, viewport?: HTMLElement | null): string[][] | null {
	const bound = getDataGridActiveBound(table);
	if (bound === null) {
		return null;
	}
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const rendered = getDataGridRenderedRowIds(table, viewport);
	const grid: string[][] = [];

	for (let rowIndex = bound.minRowIndex; rowIndex <= bound.maxRowIndex; rowIndex++) {
		const row = rows.at(rowIndex);
		if (row === undefined || !isRenderedRow(rendered, row.id)) {
			continue;
		}
		const cells = row.getAllCellsByColumnId();
		const line: string[] = [];
		for (let columnIndex = bound.minColumnIndex; columnIndex <= bound.maxColumnIndex; columnIndex++) {
			const column = columns.at(columnIndex);
			if (column === undefined || !isSelectableColumn(column)) {
				continue;
			}
			line.push(formatDataGridCellValue(column.columnDef.meta?.cellEdit, cells[column.id]?.getValue(), row.original));
		}
		grid.push(line);
	}

	return grid.length > 0 ? grid : null;
}

/** Which operation a clear batch reports. */
export type DataGridClearSource = "clear" | "cut";

/**
 * A clear/cut batch over the selection's writable cells. Read-only columns
 * are skipped silently: clearing is an intent over what the grid owns.
 * `null` when nothing clears.
 */
export function buildDataGridClearDetails<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	source: DataGridClearSource,
	activeRegionOnly: boolean,
	viewport?: HTMLElement | null,
): DataGridCellsChangeDetails<TData> | null {
	const activeBound = getDataGridActiveBound(table);
	const activeBounds: CellSelectionBounds[] = activeBound === null ? [] : [activeBound];
	const bounds = activeRegionOnly ? activeBounds : table.getCellSelectionBounds();
	if (bounds.length === 0) {
		return null;
	}
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const rendered = getDataGridRenderedRowIds(table, viewport);
	const changes: DataGridCellChange<TData>[] = [];

	for (const bound of bounds) {
		for (let rowIndex = bound.minRowIndex; rowIndex <= bound.maxRowIndex; rowIndex++) {
			const row = rows.at(rowIndex);
			if (row === undefined || !isRenderedRow(rendered, row.id)) {
				continue;
			}
			const cells = row.getAllCellsByColumnId();
			for (let columnIndex = bound.minColumnIndex; columnIndex <= bound.maxColumnIndex; columnIndex++) {
				const column = columns.at(columnIndex);
				if (column === undefined || !isSelectableColumn(column)) {
					continue;
				}
				const cellEdit = getDataGridWritableCellEdit(column, row.original);
				if (cellEdit === null) {
					continue;
				}
				changes.push({ rowId: row.id, columnId: column.id, row: row.original, previousValue: cells[column.id]?.getValue(), value: cellEdit.clearValue ?? null });
			}
		}
	}

	return changes.length > 0 ? { source, changes, rejected: [] } : null;
}

interface DataGridIndexedColumn<TData extends RowData> {
	readonly column: DataGridColumn<TData>;
	readonly displayIndex: number;
}

interface DataGridIndexedRow<TData extends RowData> {
	readonly row: Row<DataGridFeatures, TData>;
	readonly displayIndex: number;
}

/** How many rows × columns a block writes over a region (Excel semantics). */
function resolveDataGridPasteSize(blockRows: number, blockColumns: number, regionRows: number, regionColumns: number): readonly [rows: number, columns: number] {
	if (blockRows === 1 && blockColumns === 1) {
		return [regionRows, regionColumns];
	}
	if (regionRows % blockRows === 0 && regionColumns % blockColumns === 0) {
		return [regionRows, regionColumns];
	}
	return [blockRows, blockColumns];
}

/**
 * Resolves a parsed clipboard block into a paste batch, Excel semantics: a
 * 1×1 block fills the whole selected region; a block tiles when the region is
 * an exact multiple of it; otherwise it pastes once from the region's
 * top-left, clamped at the grid edges (rows are never grown).
 */
export function buildDataGridPasteDetails<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	block: readonly (readonly string[])[],
	viewport?: HTMLElement | null,
): DataGridPasteResult<TData> | null {
	if (block.length === 0) {
		return null;
	}
	const bound = getDataGridActiveBound(table);
	if (bound === null) {
		return null;
	}
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const rendered = getDataGridRenderedRowIds(table, viewport);

	// Copy COMPACTS opt-out columns away, so paste maps block columns over the
	// same compacted space, running past the region for a wider block.
	const targetColumns: DataGridIndexedColumn<TData>[] = [];
	let regionColumns = 0;
	columns.forEach((column, displayIndex): void => {
		if (displayIndex < bound.minColumnIndex || !isSelectableColumn(column)) {
			return;
		}
		targetColumns.push({ column, displayIndex });
		if (displayIndex <= bound.maxColumnIndex) {
			regionColumns += 1;
		}
	});
	if (regionColumns === 0) {
		return null;
	}

	const blockColumns = block.reduce((max, line) => Math.max(max, line.length), 1);
	const regionRows = bound.maxRowIndex - bound.minRowIndex + 1;
	const [rowCount, columnCount] = resolveDataGridPasteSize(block.length, blockColumns, regionRows, regionColumns);
	const tiled = tileDataGridClipboardBlock(block, rowCount, columnCount);
	const startRowIndex = bound.minRowIndex;

	// The next rowCount rows the view can show, from the region's top.
	const targetRows: DataGridIndexedRow<TData>[] = [];
	for (let rowIndex = startRowIndex; rowIndex < rows.length && targetRows.length < rowCount; rowIndex++) {
		const row = rows.at(rowIndex);
		if (row !== undefined && isRenderedRow(rendered, row.id)) {
			targetRows.push({ row, displayIndex: rowIndex });
		}
	}

	const changes: DataGridCellChange<TData>[] = [];
	const rejected: DataGridCellRejection[] = [];
	const writtenColumns = targetColumns.slice(0, columnCount);

	targetRows.forEach(({ row }, rowOffset): void => {
		const cells = row.getAllCellsByColumnId();
		writtenColumns.forEach(({ column }, columnOffset): void => {
			const raw = tiled.at(rowOffset)?.at(columnOffset) ?? "";
			const cellEdit = getDataGridWritableCellEdit(column, row.original);
			if (cellEdit === null) {
				rejected.push({ rowId: row.id, columnId: column.id, raw, reason: "readonly" });
				return;
			}
			const value = cellEdit.parse === undefined ? raw : cellEdit.parse(raw, row.original);
			if (value === undefined) {
				rejected.push({ rowId: row.id, columnId: column.id, raw, reason: "invalid" });
				return;
			}
			changes.push({ rowId: row.id, columnId: column.id, row: row.original, previousValue: cells[column.id]?.getValue(), value });
		});
	});

	const firstColumn = writtenColumns.at(LIST_SLOT_INDEX.first);
	const lastColumn = writtenColumns.at(-1);
	if ((changes.length === 0 && rejected.length === 0) || firstColumn === undefined || lastColumn === undefined) {
		return null;
	}
	return {
		details: { source: "paste", changes, rejected },
		target: {
			startRowIndex,
			endRowIndex: targetRows.at(-1)?.displayIndex ?? startRowIndex,
			rowCount: targetRows.length,
			startColumnIndex: firstColumn.displayIndex,
			endColumnIndex: lastColumn.displayIndex,
		},
	};
}

/**
 * The inverse batch: every change's value and previousValue swapped and
 * rejections dropped. Feed it through the same state update `onCellsChange`
 * uses to implement undo; inverting the inverse is redo.
 */
export function invertDataGridCellsChange<TData>(details: DataGridCellsChangeDetails<TData>): DataGridCellsChangeDetails<TData> {
	return {
		source: details.source,
		changes: details.changes.map((change) => ({ ...change, value: change.previousValue, previousValue: change.value })),
		rejected: [],
	};
}

function selectDataGridRegion<TData extends RowData>(table: DataGridCoreTable<TData>, target: DataGridPasteTarget): void {
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const anchorRow = rows.at(target.startRowIndex);
	const anchorColumn = columns.at(target.startColumnIndex);
	const focusRow = rows.at(Math.min(target.endRowIndex, rows.length - 1));
	const focusColumn = columns.at(target.endColumnIndex);
	if (anchorRow === undefined || anchorColumn === undefined || focusRow === undefined || focusColumn === undefined) {
		return;
	}
	table.selectCellRange({ anchorRowId: anchorRow.id, anchorColumnId: anchorColumn.id, focusRowId: focusRow.id, focusColumnId: focusColumn.id }, { mode: "replace" });
}

// ── Fill handle drag session ───────────────────────────────────────────────

/**
 * The fill drag's feedback: ONE dashed border around the whole pending
 * region (source plus extension). While the session runs the viewport carries
 * `data-cell-filling`, so the source cells' own selection chrome rests and
 * this element is the only painter.
 */
const dataGridGestureOutlineClasses = "pointer-events-none absolute outline-1 -outline-offset-1 outline-dashed outline-primary";

interface DataGridFillExtension {
	readonly axis: "row" | "column";
	readonly count: number;
}

interface DataGridFillTargets<TData extends RowData> {
	readonly rowEntries: readonly DataGridIndexedRow<TData>[];
	readonly columnEntries: readonly DataGridIndexedColumn<TData>[];
}

interface DataGridFillSessionOptions<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly viewport: HTMLElement;
	readonly onCellsChange: ((details: DataGridCellsChangeDetails<TData>) => void) | undefined;
}

function positionDataGridOutline(outline: HTMLElement, viewport: HTMLElement, first: Element | null, far: Element | null): void {
	if (first === null || far === null) {
		outline.style.display = "none";
		return;
	}
	const firstRect = first.getBoundingClientRect();
	const farRect = far.getBoundingClientRect();
	const viewportRect = viewport.getBoundingClientRect();
	const left = Math.min(firstRect.left, farRect.left);
	const top = Math.min(firstRect.top, farRect.top);
	outline.style.display = "block";
	outline.style.left = `${String(left - viewportRect.left + viewport.scrollLeft)}px`;
	outline.style.top = `${String(top - viewportRect.top + viewport.scrollTop)}px`;
	outline.style.width = `${String(Math.max(firstRect.right, farRect.right) - left)}px`;
	outline.style.height = `${String(Math.max(firstRect.bottom, farRect.bottom) - top)}px`;
}

/** The fill commit's batch: rows repeat the source rows; columns round-trip through format → parse. */
function buildDataGridFillDetails<TData extends RowData>(
	columns: readonly DataGridColumn<TData>[],
	bound: CellSelectionBounds,
	sourceRows: readonly DataGridIndexedRow<TData>[],
	extension: DataGridFillExtension,
	targets: DataGridFillTargets<TData>,
): DataGridCellsChangeDetails<TData> {
	const changes: DataGridCellChange<TData>[] = [];
	const rejected: DataGridCellRejection[] = [];

	if (extension.axis === "row") {
		targets.rowEntries.forEach(({ row: targetRow }, offset): void => {
			const sourceRow = sourceRows.at(offset % Math.max(sourceRows.length, 1))?.row;
			if (sourceRow === undefined) {
				return;
			}
			const targetCells = targetRow.getAllCellsByColumnId();
			const sourceCells = sourceRow.getAllCellsByColumnId();
			for (const { column } of targets.columnEntries) {
				if (getDataGridWritableCellEdit(column, targetRow.original) === null) {
					continue;
				}
				changes.push({
					rowId: targetRow.id,
					columnId: column.id,
					row: targetRow.original,
					previousValue: targetCells[column.id]?.getValue(),
					value: sourceCells[column.id]?.getValue(),
				});
			}
		});
		return { source: "fill", changes, rejected };
	}

	const regionColumns = bound.maxColumnIndex - bound.minColumnIndex + 1;
	for (const { row } of targets.rowEntries) {
		const cells = row.getAllCellsByColumnId();
		for (const { column: targetColumn, displayIndex } of targets.columnEntries) {
			const offset = displayIndex - (bound.maxColumnIndex + 1);
			const sourceColumn = columns.at(bound.minColumnIndex + (offset % regionColumns));
			const targetEdit = getDataGridWritableCellEdit(targetColumn, row.original);
			if (sourceColumn === undefined || targetEdit === null) {
				continue;
			}
			const sourceValue = cells[sourceColumn.id]?.getValue();
			let value: CellData = sourceValue;
			// Crossing columns is a type boundary: round-trip through the source's
			// format and the target's parse, exactly what pasting would do.
			if (targetColumn.id !== sourceColumn.id && targetEdit.parse !== undefined) {
				const raw = formatDataGridCellValue(sourceColumn.columnDef.meta?.cellEdit, sourceValue, row.original);
				const parsed = targetEdit.parse(raw, row.original);
				if (parsed === undefined) {
					rejected.push({ rowId: row.id, columnId: targetColumn.id, raw, reason: "invalid" });
					continue;
				}
				value = parsed;
			}
			changes.push({ rowId: row.id, columnId: targetColumn.id, row: row.original, previousValue: cells[targetColumn.id]?.getValue(), value });
		}
	}
	return { source: "fill", changes, rejected };
}

/**
 * Imperative document-level session, the column-resize pattern: the preview
 * is written as `data-cell-fill-target` attributes outside React, so the drag
 * costs zero re-renders until release. Fills down or right (dominant axis) by
 * repeating the source region's values; rows the view cannot show are never
 * targeted.
 */
function startDataGridFillSession<TData extends RowData>({ table, viewport, onCellsChange }: DataGridFillSessionOptions<TData>): void {
	// Fill over a multi-region selection is undefined territory; Excel refuses it too.
	if (table.getCellSelectionBounds().length > 1) {
		return;
	}
	const bound = getDataGridActiveBound(table);
	if (bound === null) {
		return;
	}
	const rows = table.getRowsInDisplayOrder();
	const columns = getDataGridDisplayOrderedColumns(table);
	const domRowIds = new Set(getDataGridDomRowIds(viewport));
	const visibleRows: DataGridIndexedRow<TData>[] = [];
	rows.forEach((row, displayIndex): void => {
		if (domRowIds.has(row.id)) {
			visibleRows.push({ row, displayIndex });
		}
	});
	const visibleIndexById = new Map(visibleRows.map((entry, index) => [entry.row.id, index]));
	const sourceRows = visibleRows.filter(({ displayIndex }) => displayIndex >= bound.minRowIndex && displayIndex <= bound.maxRowIndex);
	const lastSourceRow = sourceRows.at(-1);
	const firstSourceRow = sourceRows.at(LIST_SLOT_INDEX.first);
	const sourceEndVisibleIndex = lastSourceRow === undefined ? undefined : visibleIndexById.get(lastSourceRow.row.id);
	if (sourceEndVisibleIndex === undefined || firstSourceRow === undefined || lastSourceRow === undefined) {
		return;
	}
	const columnIndexById = new Map(columns.map((column, index) => [column.id, index]));
	const isFillableColumn = (column: DataGridColumn<TData>): boolean => isSelectableColumn(column) && getDataGridWritableCellEdit(column) !== null;
	const firstSourceColumnId = columns.at(bound.minColumnIndex)?.id;
	const lastSourceColumnId = columns.at(bound.maxColumnIndex)?.id;

	let extension: DataGridFillExtension | null = null;
	let previewCells: Element[] = [];

	const ownerDocument = viewport.ownerDocument;
	const previewOutline = ownerDocument.createElement("div");
	previewOutline.setAttribute("data-slot", "data-grid-cell-fill-preview");
	previewOutline.className = dataGridGestureOutlineClasses;
	previewOutline.style.display = "none";
	previewOutline.style.zIndex = String(DATA_GRID_GESTURE_Z_INDEX);
	viewport.appendChild(previewOutline);
	viewport.setAttribute("data-cell-filling", "");

	const positionPreviewOutline = (): void => {
		const first = firstSourceColumnId === undefined ? null : findDataGridCellElement(viewport, firstSourceRow.row.id, firstSourceColumnId);
		const lastSource = lastSourceColumnId === undefined ? null : findDataGridCellElement(viewport, lastSourceRow.row.id, lastSourceColumnId);
		positionDataGridOutline(previewOutline, viewport, first, previewCells.at(-1) ?? lastSource);
	};

	const clearPreview = (): void => {
		for (const cell of previewCells) {
			cell.removeAttribute("data-cell-fill-target");
		}
		previewCells = [];
		positionPreviewOutline();
	};

	// Only the columns the commit would actually write, so the preview never
	// tints a cell the release will skip.
	const getExtensionTargets = (): DataGridFillTargets<TData> | null => {
		if (extension === null) {
			return null;
		}
		const columnEntries = columns.map((column, displayIndex) => ({ column, displayIndex }));
		if (extension.axis === "row") {
			return {
				rowEntries: visibleRows.slice(sourceEndVisibleIndex + 1, sourceEndVisibleIndex + 1 + extension.count),
				columnEntries: columnEntries.slice(bound.minColumnIndex, bound.maxColumnIndex + 1).filter(({ column }) => isFillableColumn(column)),
			};
		}
		return {
			rowEntries: sourceRows,
			columnEntries: columnEntries.slice(bound.maxColumnIndex + 1, bound.maxColumnIndex + 1 + extension.count).filter(({ column }) => isFillableColumn(column)),
		};
	};

	const applyPreview = (): void => {
		clearPreview();
		const targets = getExtensionTargets();
		if (targets === null) {
			return;
		}
		for (const { row } of targets.rowEntries) {
			for (const { column } of targets.columnEntries) {
				if (getDataGridWritableCellEdit(column, row.original) === null) {
					continue;
				}
				const cellElement = findDataGridCellElement(viewport, row.id, column.id);
				if (cellElement === null) {
					continue;
				}
				cellElement.setAttribute("data-cell-fill-target", "true");
				previewCells.push(cellElement);
			}
		}
		positionPreviewOutline();
	};

	const handleMove = (event: MouseEvent): void => {
		const element = ownerDocument.elementFromPoint(event.clientX, event.clientY);
		const cellElement = element?.closest("td[data-col-id]") ?? null;
		const rowElement = cellElement?.closest("tr[data-row-id]") ?? null;
		if (cellElement === null || rowElement === null || !viewport.contains(cellElement)) {
			return;
		}
		const rowVisibleIndex = visibleIndexById.get(rowElement.getAttribute("data-row-id") ?? "");
		const columnIndex = columnIndexById.get(cellElement.getAttribute("data-col-id") ?? "");
		if (rowVisibleIndex === undefined || columnIndex === undefined) {
			return;
		}
		const rowsDelta = Math.max(0, rowVisibleIndex - sourceEndVisibleIndex);
		const columnsDelta = Math.max(0, columnIndex - bound.maxColumnIndex);
		const next: DataGridFillExtension | null =
			rowsDelta === 0 && columnsDelta === 0 ? null : rowsDelta >= columnsDelta ? { axis: "row", count: rowsDelta } : { axis: "column", count: columnsDelta };
		if (next?.axis === extension?.axis && next?.count === extension?.count) {
			return;
		}
		extension = next;
		applyPreview();
	};

	const finish = (commit: boolean): void => {
		ownerDocument.removeEventListener("mousemove", handleMove);
		ownerDocument.removeEventListener("mouseup", handleUp);
		ownerDocument.removeEventListener("keydown", handleKey, true);
		clearPreview();
		previewOutline.remove();
		viewport.removeAttribute("data-cell-filling");
		const finalExtension = extension;
		const targets = getExtensionTargets();
		if (!commit || finalExtension === null || onCellsChange === undefined || targets === null) {
			return;
		}
		const lastTargetRow = targets.rowEntries.at(-1);
		if (lastTargetRow === undefined) {
			return;
		}
		const details = buildDataGridFillDetails(columns, bound, sourceRows, finalExtension, targets);
		if (details.changes.length > 0 || details.rejected.length > 0) {
			onCellsChange(details);
		}
		// Grow the selection over source plus filled cells, Excel's post-fill shape.
		selectDataGridRegion(table, {
			startRowIndex: bound.minRowIndex,
			endRowIndex: finalExtension.axis === "row" ? lastTargetRow.displayIndex : bound.maxRowIndex,
			startColumnIndex: bound.minColumnIndex,
			endColumnIndex: bound.maxColumnIndex + (finalExtension.axis === "column" ? finalExtension.count : 0),
		});
	};

	const handleUp = (): void => {
		finish(true);
	};
	// Capture phase, so a cancel never also reaches the grid's own Escape handling.
	const handleKey = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") {
			return;
		}
		event.stopPropagation();
		finish(false);
	};

	ownerDocument.addEventListener("mousemove", handleMove);
	ownerDocument.addEventListener("mouseup", handleUp);
	ownerDocument.addEventListener("keydown", handleKey, true);
}

// ── Controller ─────────────────────────────────────────────────────────────

/** A target that keeps its own keys and clipboard (editors, `data-cell-interactive` widgets). */
function isDataGridEditableTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest("input, textarea, select, [contenteditable], [data-cell-interactive]") !== null;
}

/** A target that keeps its own keys: editors plus in-cell buttons, links and checkboxes. */
function isDataGridInteractiveKeyTarget(target: EventTarget | null): boolean {
	return isDataGridEditableTarget(target) || (target instanceof Element && target.closest('button, a, [role="checkbox"]') !== null);
}

function closestElement(target: EventTarget | null, selector: string): Element | null {
	return target instanceof Element ? target.closest(selector) : null;
}

/** Scrolls a cell to the nearest edge instantly (an app-level smooth scroll would animate every keystroke). */
function scrollDataGridCellIntoView(cell: Element | null): void {
	cell?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}

/** The nearest ancestor (or the element itself) that actually scrolls vertically. */
function findDataGridScroller(viewport: HTMLElement): HTMLElement | null {
	let scroller: HTMLElement | null = viewport;
	while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight) {
		scroller = scroller.parentElement;
	}
	return scroller;
}

/** Where a jump lands vertically. */
type DataGridJumpRowTarget = "first" | "last" | "same" | { readonly delta: number };

/** Where a jump lands horizontally. */
type DataGridJumpColumnTarget = "first" | "last" | "same";

function resolveDataGridJumpRowIndex(rowTarget: DataGridJumpRowTarget, rowIndex: number, rowCount: number): number {
	if (rowTarget === "first") {
		return 0;
	}
	if (rowTarget === "last") {
		return rowCount - 1;
	}
	if (rowTarget === "same") {
		return rowIndex;
	}
	return Math.min(rowCount - 1, Math.max(0, rowIndex + rowTarget.delta));
}

const KEY_DIRECTIONS: Readonly<Record<string, DataGridStepDirection>> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
};

function mirrorDataGridDirection(direction: DataGridStepDirection, rtl: boolean): DataGridStepDirection {
	if (!rtl || direction === "up" || direction === "down") {
		return direction;
	}
	return direction === "left" ? "right" : "left";
}

function isChord(event: KeyboardEvent, letter: string): boolean {
	return event.key.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`;
}

function toSnapshotBound(bound: CellSelectionBounds): DataGridCellSelectionBound {
	return { minRowIndex: bound.minRowIndex, maxRowIndex: bound.maxRowIndex, minColumnIndex: bound.minColumnIndex, maxColumnIndex: bound.maxColumnIndex };
}

/** The editor's session for the focused cell, or `null` when its column has no built-in control. */
function buildDataGridEditorSession<TData extends RowData>(
	cell: DataGridCell<TData>,
	cellEdit: DataGridColumnCellEdit,
	initialText: string | undefined,
): DataGridEditorSession | null {
	const { control } = cellEdit;
	if (control === undefined) {
		return null;
	}
	const baseline = formatDataGridCellValue(cellEdit, cell.getValue(), cell.row.original);
	return {
		rowId: cell.row.id,
		columnId: cell.column.id,
		control,
		initialValue: initialText ?? baseline,
		baseline,
		label: getColumnHeaderLabel(cell.column),
	};
}

interface DataGridCellSelectionAttachOptions<TData extends RowData> {
	readonly viewport: HTMLElement;
	readonly keyboard: boolean;
	readonly clipboard: boolean;
	/** Latest typed grid (table + write callbacks), read at event time. */
	readonly getGrid: () => DataGridTypedGrid<TData>;
	/** Latest TData-free grid props, read at event time. */
	readonly getProps: () => DataGridLayoutProps;
	readonly openEditor: (session: DataGridEditorSession) => void;
	readonly registerApi: (api: DataGridCellSelectionApi | null) => void;
}

/**
 * Wires every listener onto one body viewport and returns the teardown.
 * Plain imperative code on purpose: it reads the latest table and props
 * through the getters, so React re-renders never re-attach it.
 */
function attachDataGridCellSelection<TData extends RowData>({
	viewport,
	keyboard,
	clipboard,
	getGrid,
	getProps,
	openEditor,
	registerApi,
}: DataGridCellSelectionAttachOptions<TData>): () => void {
	const getTable = (): DataGridCoreTable<TData> => getGrid().table;
	const getOnCellsChange = (): ((details: DataGridCellsChangeDetails<TData>) => void) | undefined => getGrid().onCellsChange;
	const isRangeSelectionEnabled = (): boolean => getProps().tableLayout.cellSelectionMode !== "single";
	const ownerDocument = viewport.ownerDocument;
	const ownerWindow = ownerDocument.defaultView;

	// The focusable element of the container-focus model: the table carries
	// role="grid", so DOM focus and aria-activedescendant live on it.
	const focusTarget = viewport.querySelector<HTMLElement>(GRID_TABLE_SELECTOR) ?? viewport;

	const syncActiveDescendant = (): void => {
		const cell = viewport.querySelector<HTMLElement>(FOCUSED_CELL_SELECTOR);
		if (cell !== null && cell.id !== "") {
			focusTarget.setAttribute("aria-activedescendant", cell.id);
		} else {
			focusTarget.removeAttribute("aria-activedescendant");
		}
	};
	const nextFrame = (callback: () => void): void => {
		if (ownerWindow === null) {
			callback();
			return;
		}
		ownerWindow.requestAnimationFrame(callback);
	};

	const scrollFocusedIntoView = (targetRowIndex?: number, rowCount?: number, explicitCell?: DataGridCellAddress): void => {
		const queryScrollCell = (): Element | null =>
			explicitCell === undefined ? viewport.querySelector(FOCUSED_CELL_SELECTOR) : findDataGridCellElement(viewport, explicitCell.rowId, explicitCell.columnId);
		// After the atom write React still has to commit the data attributes;
		// a frame lands after that commit.
		nextFrame((): void => {
			const cell = queryScrollCell();
			syncActiveDescendant();
			if (cell !== null || targetRowIndex === undefined || rowCount === undefined || rowCount === 0) {
				scrollDataGridCellIntoView(cell);
				return;
			}
			// Virtualization: the jump target is not mounted. The spacer rows keep
			// scrollHeight proportional to the row count, so estimate the offset,
			// let the virtualizer mount the region, then finish precisely.
			const scroller = findDataGridScroller(viewport);
			if (scroller === null) {
				return;
			}
			scroller.scrollTop = ((targetRowIndex + HALF) / rowCount) * scroller.scrollHeight - scroller.clientHeight * HALF;
			nextFrame((): void => {
				scrollDataGridCellIntoView(queryScrollCell());
				syncActiveDescendant();
			});
		});
	};

	// Opens an editor for the focused writable cell: the grid's own overlay
	// for a column with a built-in `control`, the consumer's through
	// `onCellEditRequest` otherwise, and as a last resort the cell's own
	// interactive content. `false` when nothing can open.
	const requestCellEdit = (initialText?: string): boolean => {
		const table = getTable();
		const cell = table.getFocusedCell();
		if (cell === undefined) {
			return false;
		}
		const cellEdit = getDataGridWritableCellEdit(cell.column, cell.row.original);
		if (cellEdit !== null) {
			const session = buildDataGridEditorSession(cell, cellEdit, initialText);
			if (session !== null) {
				openEditor(session);
				return true;
			}
			const { onCellEditRequest } = getGrid();
			if (onCellEditRequest !== undefined) {
				const request: DataGridCellEditRequest<TData> = { rowId: cell.row.id, columnId: cell.column.id, row: cell.row.original, previousValue: cell.getValue() };
				onCellEditRequest(initialText === undefined ? request : { ...request, initialText });
				return true;
			}
		}
		// Generic activation, deliberate gestures only (Enter, F2, double-click):
		// focus and click the cell's primary control, in priority order.
		if (initialText !== undefined) {
			return false;
		}
		const focusedCell = viewport.querySelector(FOCUSED_CELL_SELECTOR);
		if (focusedCell === null) {
			return false;
		}
		const candidates: readonly string[] = ['[role="combobox"]', "select", "input, textarea", 'button, a, [role="checkbox"], [tabindex]:not([tabindex="-1"])'];
		for (const candidate of candidates) {
			const control = focusedCell.querySelector<HTMLElement>(candidate);
			if (control !== null) {
				control.focus();
				control.click();
				return true;
			}
		}
		return false;
	};

	// The imperative surface. One bounded timer retry (timers, unlike frames,
	// run in background tabs) settles a freshly created row's mount.
	let focusRetryTimer: ReturnType<typeof setTimeout> | undefined;
	const focusCell = (rowId: string, columnId: string, options?: DataGridFocusCellOptions): void => {
		clearTimeout(focusRetryTimer);
		let attempts = FOCUS_RETRY_ATTEMPTS;
		const attempt = (): void => {
			if (!viewport.isConnected) {
				return;
			}
			const cell = findDataGridCellElement(viewport, rowId, columnId);
			if (cell === null) {
				attempts -= 1;
				if (attempts >= 0) {
					focusRetryTimer = setTimeout(attempt, FOCUS_RETRY_DELAY_MS);
				}
				return;
			}
			getTable().setFocusedCell(rowId, columnId);
			focusTarget.focus();
			if (cell.id !== "") {
				focusTarget.setAttribute("aria-activedescendant", cell.id);
			}
			scrollDataGridCellIntoView(cell);
			if (options?.edit !== true) {
				return;
			}
			let editAttempts = FOCUS_RETRY_ATTEMPTS;
			const attemptEdit = (): void => {
				if (!cell.isConnected) {
					return;
				}
				if (cell.hasAttribute("data-cell-focused")) {
					requestCellEdit();
					return;
				}
				editAttempts -= 1;
				if (editAttempts >= 0) {
					focusRetryTimer = setTimeout(attemptEdit, FOCUS_RETRY_DELAY_MS);
				}
			};
			attemptEdit();
		};
		attempt();
	};
	registerApi({
		focusCell,
		clearSelection: (): void => {
			getTable().resetCellSelection(true);
			nextFrame(syncActiveDescendant);
		},
		scrollToCell: (rowId: string, columnId: string): void => {
			scrollDataGridCellIntoView(findDataGridCellElement(viewport, rowId, columnId));
		},
	});

	// Jump targets (Home, End, Ctrl+Arrows, PageUp/PageDown) in display-index
	// space: plain jumps collapse to the target, Shift jumps keep the active
	// range's opposite corner as the anchor.
	const jumpFocus = (rowTarget: DataGridJumpRowTarget, columnTarget: DataGridJumpColumnTarget, extend: boolean): boolean => {
		const table = getTable();
		const focused = table.getFocusedCell();
		if (focused === undefined) {
			return false;
		}
		const rows = table.getRowsInDisplayOrder();
		const allColumns = getDataGridDisplayOrderedColumns(table);
		const selectable = allColumns.filter((column) => isSelectableColumn(column));
		if (rows.length === 0 || selectable.length === 0) {
			return false;
		}
		const rowIndex = focused.row.getDisplayIndex();
		let clampedRowIndex = resolveDataGridJumpRowIndex(rowTarget, rowIndex, rows.length);
		// Walk the target back toward the focus until it lands on a rendered row,
		// so a jump never focuses an off-page row.
		const rendered = getDataGridRenderedRowIds(table, viewport);
		if (rendered !== null) {
			const step = clampedRowIndex >= rowIndex ? -1 : 1;
			let candidate = rows.at(clampedRowIndex);
			while (clampedRowIndex !== rowIndex && candidate !== undefined && !rendered.has(candidate.id)) {
				clampedRowIndex += step;
				candidate = rows.at(clampedRowIndex);
			}
		}
		const targetRow = rows.at(clampedRowIndex);
		const targetColumn = columnTarget === "first" ? selectable.at(LIST_SLOT_INDEX.first) : columnTarget === "last" ? selectable.at(-1) : focused.column;
		if (targetRow === undefined || targetColumn === undefined) {
			return false;
		}
		if (extend) {
			const corner = getDataGridActiveCorner(table);
			table.selectCellRange(
				{
					anchorRowId: corner?.rowId ?? focused.row.id,
					anchorColumnId: corner?.columnId ?? focused.column.id,
					focusRowId: targetRow.id,
					focusColumnId: targetColumn.id,
				},
				{ mode: "replace" },
			);
		} else {
			table.setFocusedCell(targetRow.id, targetColumn.id);
		}
		scrollFocusedIntoView(clampedRowIndex, rows.length, extend ? { rowId: targetRow.id, columnId: targetColumn.id } : undefined);
		return true;
	};

	// One visual-space step, the feature's move as the fallback; edges stay put.
	const moveFocusVisual = (direction: DataGridStepDirection): void => {
		const table = getTable();
		const focused = table.getFocusedCell();
		const target = focused === undefined ? null : getDataGridStepTarget(table, viewport, { rowId: focused.row.id, columnId: focused.column.id }, direction);
		if (target === "edge") {
			return;
		}
		if (target !== null) {
			table.setFocusedCell(target.rowId, target.columnId);
			return;
		}
		table.moveCellSelection(direction);
	};

	// One viewport's worth of data rows for PageUp/PageDown.
	const getPageJumpSize = (): number => {
		const row = viewport.querySelector(ROW_SELECTOR);
		const scroller = findDataGridScroller(viewport);
		const rowHeight = row === null ? 0 : row.getBoundingClientRect().height;
		const viewHeight = scroller === null || scroller.clientHeight === 0 ? viewport.clientHeight : scroller.clientHeight;
		if (rowHeight === 0 || viewHeight === 0) {
			return PAGE_JUMP_FALLBACK_ROWS;
		}
		return Math.max(1, Math.floor(viewHeight / rowHeight) - 1);
	};

	// The rows appended after the data rows (the add-row affordance, a draft
	// row), walked backwards from the end to the first data row.
	const getAppendedRows = (): HTMLElement[] => {
		const appended: HTMLElement[] = [];
		let rowElement = viewport.querySelector("tbody")?.lastElementChild ?? null;
		while (rowElement !== null && !rowElement.hasAttribute("data-row-id")) {
			if (rowElement instanceof HTMLElement && !rowElement.hasAttribute("aria-hidden")) {
				appended.unshift(rowElement);
			}
			rowElement = rowElement.previousElementSibling;
		}
		return appended;
	};

	const focusFirstIn = (row: HTMLElement | undefined): boolean => {
		if (row === undefined) {
			return false;
		}
		const focusable = row.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
		if (focusable === null) {
			return false;
		}
		focusable.focus();
		// A control that refuses focus must not report success.
		return row.ownerDocument.activeElement === focusable;
	};

	const writeSelectionToClipboard = async (): Promise<DataGridClipboardWrite | null> => {
		const grid = getDataGridActiveRegionGrid(getTable(), viewport);
		if (grid === null) {
			return null;
		}
		const text = serializeDataGridClipboardText(grid);
		// A focused grid is neither a text selection nor an editable target, so
		// the browser fires no native copy event for Cmd/Ctrl+C: write through
		// the async Clipboard API (secure contexts), both flavours when possible.
		if (!("clipboard" in navigator)) {
			return null;
		}
		try {
			if (hasGlobalConstructor("ClipboardItem")) {
				await navigator.clipboard.write([
					new ClipboardItem({
						"text/plain": new Blob([text], { type: "text/plain" }),
						"text/html": new Blob([renderDataGridClipboardHtml(grid)], { type: "text/html" }),
					}),
				]);
			} else {
				await navigator.clipboard.writeText(text);
			}
		} catch {
			// Permission denied: nothing reached the clipboard, so nothing is reported.
			return null;
		}
		return { text, grid };
	};

	const dispatchCut = (): void => {
		const onCellsChange = getOnCellsChange();
		if (onCellsChange === undefined) {
			return;
		}
		const details = buildDataGridClearDetails(getTable(), "cut", true, viewport);
		if (details !== null) {
			onCellsChange(details);
		}
	};

	const handleArrowKey = (event: KeyboardEvent, direction: DataGridStepDirection): void => {
		const table = getTable();
		const extend = event.shiftKey && isRangeSelectionEnabled();
		if (event.metaKey || event.ctrlKey) {
			// Ctrl/Cmd+Arrow jumps to the grid edge in that direction.
			const jumped =
				direction === "up"
					? jumpFocus("first", "same", extend)
					: direction === "down"
						? jumpFocus("last", "same", extend)
						: jumpFocus("same", direction === "left" ? "first" : "last", extend);
			if (jumped) {
				event.preventDefault();
			}
			return;
		}
		// ArrowDown on the last rendered row steps into the appended region.
		if (direction === "down" && !event.shiftKey) {
			const focused = table.getFocusedCell();
			const lastRenderedId = getDataGridDomRowIds(viewport).at(-1);
			if (focused !== undefined && focused.row.id === lastRenderedId && focusFirstIn(getAppendedRows().at(LIST_SLOT_INDEX.first))) {
				event.preventDefault();
				return;
			}
		}
		event.preventDefault();
		if (extend) {
			const corner = extendDataGridSelection(table, viewport, direction);
			scrollFocusedIntoView(undefined, undefined, corner ?? undefined);
			return;
		}
		moveFocusVisual(direction);
		scrollFocusedIntoView();
	};

	const handleAppendedRowKey = (event: KeyboardEvent, appendedRow: HTMLElement): boolean => {
		const appended = getAppendedRows();
		const index = appended.indexOf(appendedRow);
		// An id-less row that is NOT appended (expanded detail, the empty state) keeps every key native.
		if (index === -1) {
			return true;
		}
		if (event.key === "ArrowDown") {
			if (focusFirstIn(appended.at(index + 1))) {
				event.preventDefault();
			}
			return true;
		}
		if (event.key !== "ArrowUp") {
			return true;
		}
		if (index > 0 && focusFirstIn(appended.at(index - 1))) {
			event.preventDefault();
			return true;
		}
		// Back into the grid, on whatever cell was focused last.
		focusTarget.focus();
		syncActiveDescendant();
		event.preventDefault();
		return true;
	};

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented) {
			return;
		}
		const appendedRow = closestElement(event.target, "tbody > tr:not([data-row-id])");
		if (appendedRow instanceof HTMLElement && viewport.contains(appendedRow) && handleAppendedRowKey(event, appendedRow)) {
			return;
		}
		if (isDataGridInteractiveKeyTarget(event.target)) {
			// The ARIA grid pattern's exit gesture: Escape on an in-cell control
			// hands DOM focus back to the grid.
			const cell = closestElement(event.target, "td[data-col-id]");
			if (event.key === "Escape" && cell !== null && viewport.contains(cell)) {
				event.preventDefault();
				event.stopPropagation();
				focusTarget.focus();
				syncActiveDescendant();
			}
			return;
		}
		const table = getTable();
		const chord = (event.metaKey || event.ctrlKey) && !event.altKey;

		// AltGr arrives as Ctrl+Alt and types a character, so it is no shortcut.
		if (chord && isChord(event, "a")) {
			if (isRangeSelectionEnabled()) {
				table.selectAllCells();
				nextFrame(syncActiveDescendant);
			}
			event.preventDefault();
			return;
		}

		if (chord && clipboard && (isChord(event, "c") || isChord(event, "x"))) {
			const cut = isChord(event, "x");
			event.preventDefault();
			void writeSelectionToClipboard().then((written): void => {
				if (written === null) {
					return;
				}
				getProps().onCellsCopy?.({ ...written, cut });
				if (cut) {
					dispatchCut();
				}
			});
			return;
		}

		const arrowDirection = KEY_DIRECTIONS[event.key];
		if (arrowDirection !== undefined) {
			handleArrowKey(event, mirrorDataGridDirection(arrowDirection, getComputedStyle(viewport).direction === "rtl"));
			return;
		}
		const extend = event.shiftKey && isRangeSelectionEnabled();

		switch (event.key) {
			case "Home":
			case "End": {
				// Home/End: row start or end; with Ctrl/Cmd, the grid's corners.
				const edge = event.key === "Home" ? "first" : "last";
				const jumped = event.metaKey || event.ctrlKey ? jumpFocus(edge, edge, extend) : jumpFocus("same", edge, extend);
				if (jumped) {
					event.preventDefault();
				}
				return;
			}
			case "PageUp":
			case "PageDown": {
				const delta = (event.key === "PageUp" ? -1 : 1) * getPageJumpSize();
				if (jumpFocus({ delta }, "same", extend)) {
					event.preventDefault();
				}
				return;
			}
			case "Enter": {
				// Enter opens the editor when one is wired; the move-down stays the fallback.
				if (!event.shiftKey && requestCellEdit()) {
					event.preventDefault();
					return;
				}
				moveFocusVisual(event.shiftKey ? "up" : "down");
				event.preventDefault();
				scrollFocusedIntoView();
				return;
			}
			case "F2": {
				if (requestCellEdit()) {
					event.preventDefault();
				}
				return;
			}
			case "Tab": {
				const before = table.getFocusedCell();
				// Logical directions: Tab means "next cell" in both reading directions.
				moveFocusVisual(event.shiftKey ? "left" : "right");
				const after = table.getFocusedCell();
				// Trap Tab only while it moved; at the edges focus leaves the grid.
				if (after !== undefined && after.id !== before?.id) {
					event.preventDefault();
					scrollFocusedIntoView();
				}
				return;
			}
			case "Delete":
			case "Backspace": {
				const onCellsChange = getOnCellsChange();
				if (onCellsChange === undefined) {
					return;
				}
				const details = buildDataGridClearDetails(table, "clear", false, viewport);
				if (details !== null) {
					onCellsChange(details);
				}
				event.preventDefault();
				return;
			}
			case "Escape": {
				// Consumed only while there is a selection, so a grid in a dialog still lets Escape close it.
				if (table.getCellSelectionBounds().length > 0) {
					table.resetCellSelection(true);
					nextFrame(syncActiveDescendant);
					event.preventDefault();
					event.stopPropagation();
				}
				return;
			}
			default:
				break;
		}

		// Space on a checkbox cell toggles it, the row-select idiom.
		if (event.key === " ") {
			const checkbox = viewport.querySelector(FOCUSED_CELL_SELECTOR)?.querySelector<HTMLElement>('[role="checkbox"], input[type="checkbox"]');
			if (checkbox !== null && checkbox !== undefined) {
				checkbox.click();
				event.preventDefault();
				return;
			}
		}

		// Type-to-edit: a printable character opens the editor seeded with it.
		// Plain Ctrl/Cmd chords stay shortcuts; Ctrl+Alt (AltGr) and Alt type characters.
		if (event.key.length === PRINTABLE_KEY_LENGTH && !event.metaKey && !(event.ctrlKey && !event.altKey) && requestCellEdit(event.key)) {
			event.preventDefault();
			return;
		}

		// Space that opened nothing must not scroll the page from under the focused cell.
		if (event.key === " " && table.getFocusedCell() !== undefined) {
			event.preventDefault();
		}
	};

	const copySelection = (event: ClipboardEvent, cut: boolean): boolean => {
		const grid = getDataGridActiveRegionGrid(getTable(), viewport);
		const data = event.clipboardData;
		if (grid === null || data === null) {
			return false;
		}
		event.preventDefault();
		const text = serializeDataGridClipboardText(grid);
		data.setData("text/plain", text);
		data.setData("text/html", renderDataGridClipboardHtml(grid));
		getProps().onCellsCopy?.({ text, grid, cut });
		return true;
	};

	const handleCopy = (event: ClipboardEvent): void => {
		if (!isDataGridEditableTarget(event.target)) {
			copySelection(event, false);
		}
	};

	const handleCut = (event: ClipboardEvent): void => {
		if (!isDataGridEditableTarget(event.target) && copySelection(event, true)) {
			dispatchCut();
		}
	};

	const handlePaste = (event: ClipboardEvent): void => {
		if (isDataGridEditableTarget(event.target)) {
			return;
		}
		const onCellsChange = getOnCellsChange();
		const text = event.clipboardData?.getData("text/plain") ?? "";
		if (onCellsChange === undefined || text === "") {
			return;
		}
		event.preventDefault();
		const table = getTable();
		const result = buildDataGridPasteDetails(table, parseDataGridClipboardText(text), viewport);
		if (result === null) {
			return;
		}
		onCellsChange(result.details);
		// The pasted region becomes the selection; single mode keeps the focused cell.
		if (isRangeSelectionEnabled()) {
			selectDataGridRegion(table, result.target);
		}
	};

	// Custom-control cells follow a two-step gesture: the first click on an
	// UNFOCUSED cell only focuses it, the second activates the control, so
	// moving the focus around never fires actions. Checkboxes keep their
	// one-click toggle, `data-cell-interactive` widgets own all their
	// gestures, and single-click edit mode skips the interception.
	let pressedUnfocusedControl = false;
	const getTwoStepControl = (target: EventTarget | null): Element | null => {
		if (!(target instanceof Element) || target.closest("[data-cell-interactive]") !== null || target.closest('[role="checkbox"], input[type="checkbox"]') !== null) {
			return null;
		}
		return target.closest("[data-cell-control]") ?? target.closest('button, a, select, input, textarea, [contenteditable], [role="combobox"]');
	};
	const handleControlPointerDown = (event: PointerEvent): void => {
		pressedUnfocusedControl = false;
		if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || getProps().tableLayout.cellEditMode === "click") {
			return;
		}
		const control = getTwoStepControl(event.target);
		const cell = control?.closest("td[data-col-id]") ?? null;
		if (cell === null || !viewport.contains(cell) || cell.hasAttribute("data-cell-focused")) {
			return;
		}
		const column = getTable()
			.getAllLeafColumns()
			.find((candidate) => candidate.id === cell.getAttribute("data-col-id"));
		if (column === undefined || !isSelectableColumn(column)) {
			return;
		}
		pressedUnfocusedControl = true;
		// Stops a pointerdown-opening trigger before React's root delegation sees it.
		event.stopPropagation();
	};
	const handleControlClick = (event: MouseEvent): void => {
		if (!pressedUnfocusedControl) {
			return;
		}
		pressedUnfocusedControl = false;
		event.preventDefault();
		event.stopPropagation();
	};
	const handleControlMouseDown = (event: MouseEvent): void => {
		if (!pressedUnfocusedControl) {
			return;
		}
		// Every root-delegated handler dies with this stop, the td's own focus
		// logic included, so the selection start runs imperatively here.
		event.stopPropagation();
		event.preventDefault();
		const cell = closestElement(event.target, "td[data-col-id]");
		const rowId = cell?.closest("tr[data-row-id]")?.getAttribute("data-row-id");
		const columnId = cell?.getAttribute("data-col-id");
		if (rowId === undefined || rowId === null || columnId === undefined || columnId === null) {
			return;
		}
		const table = getTable();
		const cellApi = table
			.getRowsInDisplayOrder()
			.find((row) => row.id === rowId)
			?.getAllCellsByColumnId()[columnId];
		if (cellApi === undefined) {
			return;
		}
		if (isRangeSelectionEnabled()) {
			cellApi.getSelectionStartHandler()(event);
		} else {
			table.setFocusedCell(rowId, columnId);
		}
		focusTarget.focus();
		nextFrame(syncActiveDescendant);
	};

	// Drag-to-select outranks in-cell controls: when a drag grew the range, the
	// release click is swallowed in capture so a trigger under the pointer
	// never opens. The selection key tells a drag from a motionless click.
	let dragStartedOnCell = false;
	let dragStartSelectionKey = "";
	const getSelectionKey = (): string => `${String(getTable().getSelectedCellCount())}:${getDataGridBoundKey(getTable())}`;
	const squelchClick = (clickEvent: MouseEvent): void => {
		clickEvent.stopPropagation();
		clickEvent.preventDefault();
	};
	const handleDragMouseUp = (): void => {
		const wasDrag = dragStartedOnCell && getTable().getSelectedCellCount() > 1 && getSelectionKey() !== dragStartSelectionKey;
		dragStartedOnCell = false;
		viewport.removeAttribute("data-cell-selecting");
		if (!wasDrag) {
			return;
		}
		viewport.addEventListener("click", squelchClick, { capture: true });
		setTimeout((): void => {
			viewport.removeEventListener("click", squelchClick, true);
		}, 0);
	};

	const handleMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0) {
			return;
		}
		nextFrame(syncActiveDescendant);
		// A modifier press is a selection gesture all the way through: the grid
		// reclaims focus one task later, after the browser's focus default.
		if ((event.shiftKey || event.metaKey || event.ctrlKey) && isRangeSelectionEnabled() && closestElement(event.target, "td[data-col-id]") !== null) {
			setTimeout((): void => {
				focusTarget.focus();
			}, 0);
		}
		dragStartedOnCell = closestElement(event.target, "td") !== null;
		if (dragStartedOnCell) {
			dragStartSelectionKey = getSelectionKey();
			viewport.setAttribute("data-cell-selecting", "");
		}
		if (closestElement(event.target, '[data-slot="data-grid-cell-fill-handle"]') === null) {
			return;
		}
		// Ahead of React's root delegation, so the td underneath never starts a range drag.
		event.preventDefault();
		event.stopPropagation();
		startDataGridFillSession({ table: getTable(), viewport, onCellsChange: getOnCellsChange() });
	};

	const isFocusedCellTarget = (target: EventTarget | null): boolean => closestElement(target, "td")?.hasAttribute("data-cell-focused") === true;

	// Single-click editing (opt-in): a plain click on the focused cell edits it.
	const handleClickToEdit = (event: MouseEvent): void => {
		if (getProps().tableLayout.cellEditMode !== "click" || event.shiftKey || event.ctrlKey || event.metaKey || isDataGridInteractiveKeyTarget(event.target)) {
			return;
		}
		if (isFocusedCellTarget(event.target)) {
			requestCellEdit();
		}
	};

	// Double-click opens the editor on the cell the first click focused.
	const handleDoubleClick = (event: MouseEvent): void => {
		if (!isDataGridInteractiveKeyTarget(event.target) && isFocusedCellTarget(event.target)) {
			requestCellEdit();
		}
	};

	const previousTabIndex = focusTarget.getAttribute("tabindex");
	const previousOutline = focusTarget.style.outline;
	if (keyboard) {
		focusTarget.tabIndex = 0;
		// The focused CELL ring is the indicator; a whole-grid outline would double it.
		focusTarget.style.outline = "none";
		viewport.addEventListener("keydown", handleKeyDown);
	}
	if (clipboard) {
		viewport.addEventListener("copy", handleCopy);
		viewport.addEventListener("cut", handleCut);
		viewport.addEventListener("paste", handlePaste);
	}
	viewport.addEventListener("pointerdown", handleControlPointerDown);
	viewport.addEventListener("mousedown", handleControlMouseDown);
	viewport.addEventListener("click", handleControlClick);
	viewport.addEventListener("mousedown", handleMouseDown);
	viewport.addEventListener("click", handleClickToEdit);
	viewport.addEventListener("dblclick", handleDoubleClick);
	ownerDocument.addEventListener("mouseup", handleDragMouseUp);

	// Selection-change notifications; the snapshot is only built when a callback is wired.
	const selectionSubscription = getTable().atoms.cellSelection.subscribe((): void => {
		const { onCellSelectionChange } = getProps();
		if (onCellSelectionChange === undefined) {
			return;
		}
		const table = getTable();
		const focusedCell = table.getFocusedCell();
		const activeBound = getDataGridActiveBound(table);
		onCellSelectionChange({
			focused: focusedCell === undefined ? null : { rowId: focusedCell.row.id, columnId: focusedCell.column.id },
			bounds: table.getCellSelectionBounds().map(toSnapshotBound),
			activeBound: activeBound === null ? null : toSnapshotBound(activeBound),
			visibleCellCount: getDataGridVisibleSelectedCellCount(table, viewport),
		});
	});

	return (): void => {
		if (keyboard) {
			if (previousTabIndex === null) {
				focusTarget.removeAttribute("tabindex");
			} else {
				focusTarget.setAttribute("tabindex", previousTabIndex);
			}
			focusTarget.style.outline = previousOutline;
			focusTarget.removeAttribute("aria-activedescendant");
			viewport.removeEventListener("keydown", handleKeyDown);
		}
		if (clipboard) {
			viewport.removeEventListener("copy", handleCopy);
			viewport.removeEventListener("cut", handleCut);
			viewport.removeEventListener("paste", handlePaste);
		}
		viewport.removeEventListener("pointerdown", handleControlPointerDown);
		viewport.removeEventListener("mousedown", handleControlMouseDown);
		viewport.removeEventListener("click", handleControlClick);
		viewport.removeEventListener("mousedown", handleMouseDown);
		viewport.removeEventListener("click", handleClickToEdit);
		viewport.removeEventListener("dblclick", handleDoubleClick);
		ownerDocument.removeEventListener("mouseup", handleDragMouseUp);
		viewport.removeAttribute("data-cell-selecting");
		selectionSubscription.unsubscribe();
		clearTimeout(focusRetryTimer);
		registerApi(null);
	};
}

/** The body viewport of the grid that contains `anchor`: in split header/body grids, the one holding the body. */
function findDataGridBodyViewport(anchor: HTMLElement): HTMLElement | null {
	const root = anchor.closest('[data-slot="data-grid"]') ?? anchor.parentElement;
	if (root === null) {
		return null;
	}
	const viewports = [...root.querySelectorAll<HTMLElement>('[data-slot="data-grid-table-viewport"]')];
	return viewports.find((node) => node.querySelector('[data-slot="data-grid-table-body"]') !== null) ?? viewports.at(LIST_SLOT_INDEX.first) ?? null;
}

// ── Built-in editor overlay ────────────────────────────────────────────────

const TextAlignSchema = z.enum(["start", "end", "left", "right", "center", "justify", "match-parent"]);

function parsePixels(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The editor box: flush over the focused cell with the cell's own font,
 * alignment and padding, so the text keeps its exact place. Rect deltas are
 * visual; the viewport's scroll offset is added back for a viewport that is
 * itself the scroll container.
 */
function measureDataGridCellEditorStyle(viewport: HTMLElement): React.CSSProperties | null {
	const cell = viewport.querySelector<HTMLElement>(FOCUSED_CELL_SELECTOR);
	if (cell === null) {
		return null;
	}
	const cellRect = cell.getBoundingClientRect();
	const viewportRect = viewport.getBoundingClientRect();
	const cellStyle = getComputedStyle(cell);
	const fontLineHeight = parsePixels(cellStyle.fontSize) * LINE_HEIGHT_FONT_RATIO;
	const lineHeight = parsePixels(cellStyle.lineHeight) || fontLineHeight || DEFAULT_LINE_HEIGHT_PX;
	// Symmetric block padding sized to centre one line, like the td's align-middle.
	const centeredBlockPadding = Math.max(parsePixels(cellStyle.paddingTop), (cellRect.height - lineHeight) * HALF);
	const textAlign = TextAlignSchema.safeParse(cellStyle.textAlign);
	return {
		left: cellRect.left - viewportRect.left + viewport.scrollLeft,
		top: cellRect.top - viewportRect.top + viewport.scrollTop,
		width: cellRect.width,
		minHeight: cellRect.height,
		zIndex: DATA_GRID_GESTURE_Z_INDEX,
		fontFamily: cellStyle.fontFamily,
		fontSize: cellStyle.fontSize,
		fontWeight: cellStyle.fontWeight,
		fontStyle: cellStyle.fontStyle,
		lineHeight: cellStyle.lineHeight,
		letterSpacing: cellStyle.letterSpacing,
		textAlign: textAlign.success ? textAlign.data : undefined,
		paddingLeft: cellStyle.paddingLeft,
		paddingRight: cellStyle.paddingRight,
		paddingTop: centeredBlockPadding,
		paddingBottom: centeredBlockPadding,
	};
}

/** Focuses the editor and puts the caret at the END of the value (the F2 convention). */
function focusEditorAtEnd(element: HTMLInputElement | HTMLTextAreaElement | null): void {
	if (element === null) {
		return;
	}
	const end = element.value.length;
	element.focus();
	element.setSelectionRange(end, end);
}

const dataGridCellEditorVariants = cva("absolute box-border resize-none bg-background text-foreground outline-1 -outline-offset-1 outline-primary outline-solid", {
	variants: {
		control: {
			text: "",
			textarea: "field-sizing-content overflow-hidden",
		},
	},
	defaultVariants: {
		control: "text",
	},
});

type DataGridEditorElement = HTMLInputElement | HTMLTextAreaElement;

interface DataGridCellEditorOverlayProps {
	readonly viewport: HTMLElement;
	readonly session: DataGridEditorSession;
	readonly enterAdvance: boolean;
	readonly onCommit: (raw: string, advance: DataGridEditorAdvance, refocus: boolean) => void;
	readonly onCancel: () => void;
}

function DataGridCellEditorOverlay({ viewport, session, enterAdvance, onCommit, onCancel }: DataGridCellEditorOverlayProps): React.JSX.Element | null {
	// Measured once: the overlay remounts per cell via its key.
	const [style] = React.useState((): React.CSSProperties | null => measureDataGridCellEditorStyle(viewport));
	const finishedRef = React.useRef(false);

	React.useEffect((): void => {
		if (style === null) {
			onCancel();
		}
	}, [style, onCancel]);

	// External row changes mid-edit move or remove the cell under the overlay;
	// cancel instead of committing somewhere the user cannot see.
	React.useEffect((): (() => void) | undefined => {
		const body = viewport.querySelector("tbody");
		if (body === null || !hasGlobalConstructor("MutationObserver")) {
			return undefined;
		}
		const observer = new MutationObserver((): void => {
			if (!finishedRef.current) {
				onCancel();
			}
		});
		observer.observe(body, { childList: true, subtree: true });
		return (): void => {
			observer.disconnect();
		};
	}, [viewport, onCancel]);

	const finish = React.useCallback(
		(element: DataGridEditorElement, commit: boolean, advance: DataGridEditorAdvance, refocus: boolean): void => {
			// One finish per session: an Enter commit can be chased by the unmount's blur.
			if (finishedRef.current) {
				return;
			}
			finishedRef.current = true;
			if (commit) {
				onCommit(element.value, advance, refocus);
			} else {
				onCancel();
			}
		},
		[onCommit, onCancel],
	);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<DataGridEditorElement>): void => {
			const element = event.currentTarget;
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				finish(element, false, null, true);
				return;
			}
			if (event.key === "Tab") {
				event.preventDefault();
				finish(element, true, event.shiftKey ? "left" : "right", true);
				return;
			}
			// A textarea keeps Shift/Alt+Enter as a newline.
			if (event.key !== "Enter" || (session.control === "textarea" && (event.shiftKey || event.altKey))) {
				return;
			}
			event.preventDefault();
			finish(element, true, enterAdvance ? (event.shiftKey ? "up" : "down") : null, true);
		},
		[finish, enterAdvance, session.control],
	);

	const handleBlur = React.useCallback(
		(event: React.FocusEvent<DataGridEditorElement>): void => {
			finish(event.currentTarget, true, null, false);
		},
		[finish],
	);

	if (style === null) {
		return null;
	}
	const className = dataGridCellEditorVariants({ control: session.control });

	return createPortal(
		session.control === "textarea" ? (
			<textarea
				data-slot="data-grid-cell-editor"
				ref={focusEditorAtEnd}
				aria-label={session.label}
				defaultValue={session.initialValue}
				rows={1}
				style={style}
				className={className}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
			/>
		) : (
			<input
				data-slot="data-grid-cell-editor"
				ref={focusEditorAtEnd}
				aria-label={session.label}
				defaultValue={session.initialValue}
				style={style}
				className={className}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
			/>
		),
		viewport,
	);
}

// ── DataGridCellSelection ──────────────────────────────────────────────────

/** The editor commit as a batch: nothing for an unchanged value, a rejection for a failed parse. */
function buildDataGridEditDetails<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	session: DataGridEditorSession,
	raw: string,
): DataGridCellsChangeDetails<TData> | null {
	if (raw === session.baseline) {
		return null;
	}
	const row = table.getRowsInDisplayOrder().find((candidate) => candidate.id === session.rowId);
	const column = table.getAllLeafColumns().find((candidate) => candidate.id === session.columnId);
	const cellEdit = row === undefined || column === undefined ? null : getDataGridWritableCellEdit(column, row.original);
	if (row === undefined || column === undefined || cellEdit === null) {
		return null;
	}
	const value = cellEdit.parse === undefined ? raw : cellEdit.parse(raw, row.original);
	if (value === undefined) {
		return { source: "edit", changes: [], rejected: [{ rowId: session.rowId, columnId: session.columnId, raw, reason: "invalid" }] };
	}
	return {
		source: "edit",
		changes: [{ rowId: session.rowId, columnId: session.columnId, row: row.original, previousValue: row.getAllCellsByColumnId()[column.id]?.getValue(), value }],
		rejected: [],
	};
}

interface DataGridCellSelectionControllerProps<TData extends RowData> {
	readonly grid: DataGridTypedGrid<TData>;
	readonly keyboard: boolean;
	readonly clipboard: boolean;
	readonly registerApi: (api: DataGridCellSelectionApi | null) => void;
}

function DataGridCellSelectionController<TData extends RowData>({ grid, keyboard, clipboard, registerApi }: DataGridCellSelectionControllerProps<TData>): React.JSX.Element {
	const { props } = useDataGrid();
	const enabled = props.tableLayout.cellSelection;
	const [viewportEl, setViewportEl] = React.useState<HTMLElement | null>(null);
	const [editorSession, setEditorSession] = React.useState<DataGridEditorSession | null>(null);

	// Latest-value refs: the attached listeners read the current table and
	// props at event time, so a re-render never re-attaches them.
	const gridRef = React.useRef(grid);
	const propsRef = React.useRef(props);
	React.useLayoutEffect((): void => {
		gridRef.current = grid;
		propsRef.current = props;
	});

	// The anchor resolves the grid's body viewport once the whole tree is
	// committed (ref callbacks run after every DOM node of the commit exists).
	const handleAnchorRef = React.useCallback(
		(anchor: HTMLSpanElement | null): void => {
			setViewportEl(anchor === null || !enabled ? null : findDataGridBodyViewport(anchor));
		},
		[enabled],
	);

	const { atoms } = grid.table;
	React.useEffect((): (() => void) | undefined => {
		if (!enabled || viewportEl === null) {
			return undefined;
		}
		return attachDataGridCellSelection({
			viewport: viewportEl,
			keyboard,
			clipboard,
			getGrid: (): DataGridTypedGrid<TData> => gridRef.current,
			getProps: (): DataGridLayoutProps => propsRef.current,
			openEditor: setEditorSession,
			registerApi,
		});
	}, [enabled, viewportEl, keyboard, clipboard, registerApi, atoms]);

	// The editor overlay covers the cell but not the fill handle; the viewport
	// flags the session so the handle hides, as it does during a drag.
	React.useEffect((): (() => void) | undefined => {
		if (viewportEl === null || editorSession === null) {
			return undefined;
		}
		viewportEl.setAttribute("data-cell-editing", "");
		return (): void => {
			viewportEl.removeAttribute("data-cell-editing");
		};
	}, [viewportEl, editorSession]);

	// Closing an editor finished with keys hands focus back to the grid (after
	// an optional advance); a blur-initiated close must NOT steal focus back.
	const closeEditorSession = React.useCallback(
		(advance: DataGridEditorAdvance, refocus: boolean): void => {
			setEditorSession(null);
			if (viewportEl === null) {
				return;
			}
			const { table } = gridRef.current;
			const focused = table.getFocusedCell();
			if (advance !== null && focused !== undefined) {
				const target = getDataGridStepTarget(table, viewportEl, { rowId: focused.row.id, columnId: focused.column.id }, advance);
				if (target === null) {
					table.moveCellSelection(advance);
				} else if (target !== "edge") {
					table.setFocusedCell(target.rowId, target.columnId);
				}
			}
			if (!refocus) {
				return;
			}
			requestAnimationFrame((): void => {
				const focusElement = viewportEl.querySelector<HTMLElement>(GRID_TABLE_SELECTOR) ?? viewportEl;
				focusElement.focus();
				const cell = viewportEl.querySelector<HTMLElement>(FOCUSED_CELL_SELECTOR);
				if (cell !== null && cell.id !== "") {
					focusElement.setAttribute("aria-activedescendant", cell.id);
				}
				scrollDataGridCellIntoView(cell);
			});
		},
		[viewportEl],
	);

	const commitEditorSession = React.useCallback(
		(raw: string, advance: DataGridEditorAdvance, refocus: boolean): void => {
			const session = editorSession;
			closeEditorSession(advance, refocus);
			const { onCellsChange, table } = gridRef.current;
			if (session === null || onCellsChange === undefined) {
				return;
			}
			const details = buildDataGridEditDetails(table, session, raw);
			if (details !== null) {
				onCellsChange(details);
			}
		},
		[editorSession, closeEditorSession],
	);

	const cancelEditorSession = React.useCallback((): void => {
		closeEditorSession(null, true);
	}, [closeEditorSession]);

	return (
		<>
			<span ref={handleAnchorRef} hidden data-slot="data-grid-cell-selection" />
			{enabled && viewportEl !== null && editorSession !== null ? (
				<DataGridCellEditorOverlay
					key={`${editorSession.rowId}:${editorSession.columnId}`}
					viewport={viewportEl}
					session={editorSession}
					enterAdvance={props.tableLayout.cellEditEnterAdvance}
					onCommit={commitEditorSession}
					onCancel={cancelEditorSession}
				/>
			) : null}
		</>
	);
}

export interface DataGridCellSelectionProps {
	/** Receives the controller's imperative API (also exposed through `ref`), e.g. for create-row flows. */
	readonly apiRef?: React.Ref<DataGridCellSelectionApi>;
	/** Native copy, cut and paste handling. Defaults to `true`. */
	readonly clipboard?: boolean;
	/** Arrows (Ctrl/Cmd edge jumps), Home/End, PageUp/PageDown, Enter, F2, type-to-edit, Tab, Ctrl/Cmd+A, Delete, Escape. Defaults to `true`. */
	readonly keyboard?: boolean;
}

/**
 * Headless spreadsheet controller: keyboard navigation, clipboard, clear,
 * editing and the fill-handle drag. Mount once inside `<DataGrid>` (in the
 * same `DataGridContainer` as the table) with `tableLayout.cellSelection` on.
 * Renders only a hidden anchor; its `ref` is the imperative
 * `DataGridCellSelectionApi`.
 */
export const DataGridCellSelection = React.forwardRef<DataGridCellSelectionApi, DataGridCellSelectionProps>(function DataGridCellSelection(
	{ apiRef, clipboard = true, keyboard = true },
	ref,
): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const implementationRef = React.useRef<DataGridCellSelectionApi | null>(null);
	const registerApi = React.useCallback((api: DataGridCellSelectionApi | null): void => {
		implementationRef.current = api;
	}, []);
	// Stable proxies: the listeners (and their API) attach after mount, and
	// re-attach when the viewport changes; callers keep one handle throughout.
	const createHandle = React.useCallback(
		(): DataGridCellSelectionApi => ({
			focusCell: (rowId: string, columnId: string, options?: DataGridFocusCellOptions): void => {
				implementationRef.current?.focusCell(rowId, columnId, options);
			},
			clearSelection: (): void => {
				implementationRef.current?.clearSelection();
			},
			scrollToCell: (rowId: string, columnId: string): void => {
				implementationRef.current?.scrollToCell(rowId, columnId);
			},
		}),
		[],
	);
	React.useImperativeHandle(ref, createHandle, [createHandle]);
	React.useImperativeHandle(apiRef, createHandle, [createHandle]);

	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <DataGridCellSelectionController grid={grid} keyboard={keyboard} clipboard={clipboard} registerApi={registerApi} />,
		}),
		[keyboard, clipboard, registerApi],
	);
	return withGrid(visitor);
});

// ── DataGridSelectionBar ───────────────────────────────────────────────────

export const dataGridSelectionBarVariants = cva("flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5", {
	variants: {
		variant: {
			// The floating toolbar: centred and sticky to the viewport bottom (above pinned cells, like the sticky header).
			floating: "sticky inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[calc(100%-2rem)] shadow-lg",
			inline: "w-full",
		},
	},
	defaultVariants: {
		variant: "floating",
	},
});

export interface DataGridSelectionBarProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children">, VariantProps<typeof dataGridSelectionBarVariants> {
	/** The consumer's bulk-action controls. */
	readonly children?: React.ReactNode;
	/** Overrides the `selectionBarCount` label. */
	readonly label?: (count: number) => React.ReactNode;
	/** Overrides the `selectionBarClear` label. */
	readonly clearLabel?: React.ReactNode;
	/** Called after the clear button reset the row selection. */
	readonly onClear?: () => void;
}

interface DataGridSelectionBarContentProps<TData extends RowData> extends DataGridSelectionBarProps {
	readonly grid: DataGridTypedGrid<TData>;
	readonly barRef: React.ForwardedRef<HTMLDivElement>;
}

function DataGridSelectionBarContent<TData extends RowData>({
	grid,
	barRef,
	children,
	className,
	variant,
	label,
	clearLabel,
	onClear,
	...props
}: DataGridSelectionBarContentProps<TData>): React.JSX.Element | null {
	const { labels } = useDataGrid();
	const { table } = grid;
	const rowSelection = useDataGridAtom(table.atoms.rowSelection);
	const count = React.useMemo((): number => (Object.keys(rowSelection).length === 0 ? 0 : table.getSelectedRowModel().rows.length), [rowSelection, table]);
	const handleClear = React.useCallback((): void => {
		table.resetRowSelection();
		onClear?.();
	}, [table, onClear]);

	if (count === 0) {
		return null;
	}
	return (
		<div ref={barRef} data-slot="data-grid-selection-bar" className={cn(dataGridSelectionBarVariants({ variant }), className)} {...props}>
			<span className="text-sm font-medium text-foreground">{label === undefined ? labels.selectionBarCount(count) : label(count)}</span>
			<div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
				{children}
				<Button variant="ghost" size="sm" onClick={handleClear}>
					{clearLabel ?? labels.selectionBarClear}
				</Button>
			</div>
		</div>
	);
}

/**
 * Thin shell over row selection for bulk actions: the selected count, a slot
 * for the consumer's controls, and a clear action. Hidden while nothing is
 * selected; what the controls do stays consumer-owned.
 */
export const DataGridSelectionBar = React.forwardRef<HTMLDivElement, DataGridSelectionBarProps>(function DataGridSelectionBar(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <DataGridSelectionBarContent grid={grid} barRef={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
