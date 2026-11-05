// The cell selection's model (enhancement 8.1: split from data-grid-cell-selection.tsx): its constants and types, the selection and step arithmetic, the paste
// and clear details, and the key and jump helpers.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	DATA_GRID_PINNED_CELL_Z_INDEX,
	type DataGridCell,
	type DataGridCellAddress,
	type DataGridCellChange,
	type DataGridCellEditorControl,
	type DataGridCellRejection,
	type DataGridCellSelectionBound,
	type DataGridCellsChangeDetails,
	type DataGridColumn,
	type DataGridColumnCellEdit,
	type DataGridCoreTable,
	type DataGridFeatures,
	getColumnHeaderLabel,
} from "@workspace/ui/components/data-grid/data-grid";
import type { CellSelectionBounds, Row, RowData } from "@tanstack/react-table";
import {
	formatDataGridCellValue,
	getDataGridDisplayOrderedColumns,
	getDataGridWritableCellEdit,
	isSelectableColumn,
	tileDataGridClipboardBlock,
} from "./data-grid-cell-selection-clipboard";

/** Gesture outlines and the editor sit above sticky pinned cells, below the sticky header (z-40). */
export const DATA_GRID_GESTURE_LAYER_OFFSET = 5;
export const DATA_GRID_GESTURE_Z_INDEX = DATA_GRID_PINNED_CELL_Z_INDEX + DATA_GRID_GESTURE_LAYER_OFFSET;

/** How often, and how far apart, `focusCell` retries while a freshly created row mounts. */
export const FOCUS_RETRY_ATTEMPTS = 12;
export const FOCUS_RETRY_DELAY_MS = 32;

/** PageUp/PageDown step when nothing is measurable (jsdom, a collapsed grid). */
export const PAGE_JUMP_FALLBACK_ROWS = 10;

/** Line-height fallbacks for the editor overlay when the cell's computed style is `normal`. */
export const LINE_HEIGHT_FONT_RATIO = 1.5;
export const DEFAULT_LINE_HEIGHT_PX = 20;

/** Half of a length: centring math (a row's middle, a centred line). */
export const HALF = 0.5;

/** A printable key reports one character in `KeyboardEvent.key`. */
export const PRINTABLE_KEY_LENGTH = 1;

export const ROW_SELECTOR = "tbody tr[data-row-id]";
export const FOCUSED_CELL_SELECTOR = "td[data-cell-focused]";
export const GRID_TABLE_SELECTOR = 'table[data-slot="data-grid-table"]';

// ── Types ──────────────────────────────────────────────────────────────────

/** A one-step direction in the grid. */
export type DataGridStepDirection = "up" | "down" | "left" | "right";

/** Where a finished edit sends the focused cell, or `null` to stay. */
export type DataGridEditorAdvance = DataGridStepDirection | null;

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
export interface DataGridEditorSession {
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
export interface DataGridClipboardWrite {
	readonly text: string;
	readonly grid: string[][];
}

// ── Clipboard text: pure ───────────────────────────────────────────────────

/** The ids of the data rows the body currently renders, in DOM order. */
export function getDataGridDomRowIds(viewport: HTMLElement): string[] {
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
export function findDataGridRowElement(viewport: HTMLElement, rowId: string): HTMLTableRowElement | null {
	for (const rowElement of viewport.querySelectorAll<HTMLTableRowElement>(ROW_SELECTOR)) {
		if (rowElement.getAttribute("data-row-id") === rowId) {
			return rowElement;
		}
	}
	return null;
}

/** The rendered `<td>` of a cell. */
export function findDataGridCellElement(viewport: HTMLElement, rowId: string, columnId: string): HTMLTableCellElement | null {
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
export function getDataGridRenderedRowIds<TData extends RowData>(table: DataGridCoreTable<TData>, viewport: HTMLElement | null | undefined): Set<string> | null {
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

export function isRenderedRow(rendered: Set<string> | null, rowId: string): boolean {
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

export function boundContains(bound: CellSelectionBounds, rowIndex: number, columnIndex: number): boolean {
	return rowIndex >= bound.minRowIndex && rowIndex <= bound.maxRowIndex && columnIndex >= bound.minColumnIndex && columnIndex <= bound.maxColumnIndex;
}

/**
 * The bound of the ACTIVE (most recent) region: the one containing the
 * focused cell (the newest range's anchor), falling back to the geometric
 * last when the newest range was an exclude.
 */
export function getDataGridActiveBound<TData extends RowData>(table: DataGridCoreTable<TData>): CellSelectionBounds | null {
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
export type DataGridStepTarget = DataGridCellAddress | "edge" | null;

/**
 * The cell one visual step away: selectable columns horizontally, RENDERED
 * row order vertically, so navigation crosses pinned rows and pagination
 * windows the feature's own move cannot resolve.
 */
export function getDataGridStepTarget<TData extends RowData>(
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
export function getDataGridActiveCorner<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridCellAddress | null {
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

export function getDataGridBoundKey<TData extends RowData>(table: DataGridCoreTable<TData>): string {
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
export function extendDataGridSelection<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	viewport: HTMLElement,
	direction: DataGridStepDirection,
): DataGridCellAddress | null {
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

export interface DataGridIndexedColumn<TData extends RowData> {
	readonly column: DataGridColumn<TData>;
	readonly displayIndex: number;
}

export interface DataGridIndexedRow<TData extends RowData> {
	readonly row: Row<DataGridFeatures, TData>;
	readonly displayIndex: number;
}

/** How many rows × columns a block writes over a region (Excel semantics). */
export function resolveDataGridPasteSize(blockRows: number, blockColumns: number, regionRows: number, regionColumns: number): readonly [rows: number, columns: number] {
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

export function selectDataGridRegion<TData extends RowData>(table: DataGridCoreTable<TData>, target: DataGridPasteTarget): void {
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

/** A target that keeps its own keys and clipboard (editors, `data-cell-interactive` widgets). */
export function isDataGridEditableTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest("input, textarea, select, [contenteditable], [data-cell-interactive]") !== null;
}

/** A target that keeps its own keys: editors plus in-cell buttons, links and checkboxes. */
export function isDataGridInteractiveKeyTarget(target: EventTarget | null): boolean {
	return isDataGridEditableTarget(target) || (target instanceof Element && target.closest('button, a, [role="checkbox"]') !== null);
}

export function closestElement(target: EventTarget | null, selector: string): Element | null {
	return target instanceof Element ? target.closest(selector) : null;
}

/** Scrolls a cell to the nearest edge instantly (an app-level smooth scroll would animate every keystroke). */
export function scrollDataGridCellIntoView(cell: Element | null): void {
	cell?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}

/** The nearest ancestor (or the element itself) that actually scrolls vertically. */
export function findDataGridScroller(viewport: HTMLElement): HTMLElement | null {
	let scroller: HTMLElement | null = viewport;
	while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight) {
		scroller = scroller.parentElement;
	}
	return scroller;
}

/** Where a jump lands vertically. */
export type DataGridJumpRowTarget = "first" | "last" | "same" | { readonly delta: number };

/** Where a jump lands horizontally. */
export type DataGridJumpColumnTarget = "first" | "last" | "same";

export function resolveDataGridJumpRowIndex(rowTarget: DataGridJumpRowTarget, rowIndex: number, rowCount: number): number {
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

export const KEY_DIRECTIONS: Readonly<Record<string, DataGridStepDirection>> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
};

export function mirrorDataGridDirection(direction: DataGridStepDirection, rtl: boolean): DataGridStepDirection {
	if (!rtl || direction === "up" || direction === "down") {
		return direction;
	}
	return direction === "left" ? "right" : "left";
}

export function isChord(event: KeyboardEvent, letter: string): boolean {
	return event.key.toLowerCase() === letter || event.code === `Key${letter.toUpperCase()}`;
}

export function toSnapshotBound(bound: CellSelectionBounds): DataGridCellSelectionBound {
	return { minRowIndex: bound.minRowIndex, maxRowIndex: bound.maxRowIndex, minColumnIndex: bound.minColumnIndex, maxColumnIndex: bound.maxColumnIndex };
}

/** The editor's session for the focused cell, or `null` when its column has no built-in control. */
export function buildDataGridEditorSession<TData extends RowData>(
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
