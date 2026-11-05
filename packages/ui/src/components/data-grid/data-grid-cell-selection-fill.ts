// The cell selection's fill handle (enhancement 8.1: split from data-grid-cell-selection.tsx): the outline, the fill details and the drag session.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	type DataGridCellChange,
	type DataGridCellRejection,
	type DataGridCellsChangeDetails,
	type DataGridColumn,
	type DataGridCoreTable,
} from "@workspace/ui/components/data-grid/data-grid";
import type { CellData, CellSelectionBounds, RowData } from "@tanstack/react-table";
import { formatDataGridCellValue, getDataGridDisplayOrderedColumns, getDataGridWritableCellEdit, isSelectableColumn } from "./data-grid-cell-selection-clipboard";
import {
	DATA_GRID_GESTURE_Z_INDEX,
	type DataGridIndexedColumn,
	type DataGridIndexedRow,
	findDataGridCellElement,
	getDataGridActiveBound,
	getDataGridDomRowIds,
	selectDataGridRegion,
} from "./data-grid-cell-selection-model";

/**
 * The fill drag's feedback: ONE dashed border around the whole pending
 * region (source plus extension). While the session runs the viewport carries
 * `data-cell-filling`, so the source cells' own selection chrome rests and
 * this element is the only painter.
 */
export const dataGridGestureOutlineClasses = "pointer-events-none absolute outline-1 -outline-offset-1 outline-dashed outline-primary";

export interface DataGridFillExtension {
	readonly axis: "row" | "column";
	readonly count: number;
}

export interface DataGridFillTargets<TData extends RowData> {
	readonly rowEntries: readonly DataGridIndexedRow<TData>[];
	readonly columnEntries: readonly DataGridIndexedColumn<TData>[];
}

export interface DataGridFillSessionOptions<TData extends RowData> {
	readonly table: DataGridCoreTable<TData>;
	readonly viewport: HTMLElement;
	readonly onCellsChange: ((details: DataGridCellsChangeDetails<TData>) => void) | undefined;
}

export function positionDataGridOutline(outline: HTMLElement, viewport: HTMLElement, first: Element | null, far: Element | null): void {
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
export function buildDataGridFillDetails<TData extends RowData>(
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
export function startDataGridFillSession<TData extends RowData>({ table, viewport, onCellsChange }: DataGridFillSessionOptions<TData>): void {
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
