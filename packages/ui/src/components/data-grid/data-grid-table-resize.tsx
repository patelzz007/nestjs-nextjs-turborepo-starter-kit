"use client";

// Column resizing for the data grid table (enhancement 8.1: split from data-grid-table.tsx): pointer, keyboard and the live size vars.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	type DataGridAutoSizeController,
	type DataGridColumn,
	type DataGridCoreTable,
	type DataGridGridVisitor,
	type DataGridResolvedTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import { type ColumnSizingState, type RowData } from "@tanstack/react-table";
import * as React from "react";
import {
	type DataGridHeader,
	type DataGridStyle,
	NON_PASSIVE_LISTENER,
	RESIZE_MIN_DELTA_RATIO,
	SIZE_ROUNDING_FACTOR,
	getDataGridHeaderLeafColumns,
	getDataGridTableAllFlatHeaders,
	getDataGridTableFillMeasurementTarget,
	hasDataGridFillColumn,
} from "./data-grid-table-layout";

/**
 * TanStack's own default, restated: v9 resolves feature defaults internally
 * and may leave the option unset on the instance.
 */
export const DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE = "onEnd";

export function isOnEndResizeMode<TData extends RowData>(layout: DataGridResolvedTableLayout, table: DataGridCoreTable<TData>): boolean {
	return (layout.columnsResizeMode ?? table.options.columnResizeMode ?? DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE) === DATA_GRID_DEFAULT_COLUMN_RESIZE_MODE;
}

/** End-pinned columns grow from their start edge, so their geometry runs mirrored, like RTL. */
export function isMirroredResize<TData extends RowData>(table: DataGridCoreTable<TData>, column: DataGridColumn<TData>): boolean {
	return (table.options.columnResizeDirection === "rtl") !== (column.getIsPinned() === "end");
}

/** The column-size CSS variables of every rendered header (`--header-x-size`, `--col-x-size`). */
export function getDataGridColumnSizeVars<TData extends RowData>(table: DataGridCoreTable<TData>): DataGridStyle {
	const fillColumnId = table.getVisibleLeafColumns().find((column) => column.columnDef.meta?.fillWidth === true)?.id;
	const vars: DataGridStyle = {};
	for (const header of getDataGridTableAllFlatHeaders(table)) {
		vars[`--header-${header.id}-size`] = header.getSize();
		vars[`--col-${header.column.id}-size`] =
			header.column.id === fillColumnId ? `calc(${String(header.column.getSize())} + var(--data-grid-fill, 0))` : header.column.getSize();
	}
	return vars;
}

// ── Column resize session ──────────────────────────────────────────────────

export type DataGridResizeStartEvent = React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>;

export type DataGridResizeDocumentEvent = MouseEvent | TouchEvent;

export interface DataGridTouchPoint {
	readonly identifier: number;
	readonly clientX: number;
}

export interface DataGridTouchListLike {
	readonly length: number;
	item(index: number): DataGridTouchPoint | null;
}

export function isDataGridTouchEvent(event: DataGridResizeStartEvent | DataGridResizeDocumentEvent): event is React.TouchEvent<HTMLElement> | TouchEvent {
	return "touches" in event;
}

export function findTouchClientX(list: DataGridTouchListLike, identifier: number): number | undefined {
	for (let index = 0; index < list.length; index++) {
		const touch = list.item(index);
		if (touch?.identifier === identifier) {
			return touch.clientX;
		}
	}
	return undefined;
}

export function firstTouch(list: DataGridTouchListLike): DataGridTouchPoint | undefined {
	return list.length > 0 ? (list.item(LIST_SLOT_INDEX.first) ?? undefined) : undefined;
}

export function getDataGridResizeEventClientX(event: DataGridResizeStartEvent | DataGridResizeDocumentEvent, touchIdentifier?: number): number | undefined {
	if (!isDataGridTouchEvent(event)) {
		return event.clientX;
	}
	if (touchIdentifier !== undefined) {
		return findTouchClientX(event.touches, touchIdentifier) ?? findTouchClientX(event.changedTouches, touchIdentifier);
	}
	return firstTouch(event.touches)?.clientX ?? firstTouch(event.changedTouches)?.clientX;
}

/** The min/max delta ratio a drag may reach, from the leaves' resolved min/max sizes. */
export function getResizeDeltaBounds<TData extends RowData>(
	table: DataGridCoreTable<TData>,
	sizingStart: readonly (readonly [string, number])[],
): { readonly min: number; readonly max: number } {
	let min = RESIZE_MIN_DELTA_RATIO;
	let max = Number.POSITIVE_INFINITY;
	for (const [columnId, size] of sizingStart) {
		if (size > 0) {
			const def = table.getColumn(columnId)?.columnDef;
			if (def?.minSize !== undefined) {
				min = Math.max(min, def.minSize / size - 1);
			}
			if (def?.maxSize !== undefined && Number.isFinite(def.maxSize)) {
				max = Math.min(max, def.maxSize / size - 1);
			}
		}
	}
	return { min, max };
}

/** The size expression written to a column's live variable (the fill column adds the free space). */
export function liveColumnSizeValue(columnId: string, size: number, fillColumnId: string | undefined): string {
	return columnId === fillColumnId ? `calc(${String(size)} + var(--data-grid-fill, 0))` : String(size);
}

/**
 * Starts a column resize drag. `live` (onChange mode) writes per-move widths
 * straight to the table element's `--col/--header` variables — zero React
 * renders during the drag — and commits sizing state once at release; onEnd
 * mode tracks the drag in `columnResizing` state for the indicator and
 * commits at release. Returns a teardown that ends the session.
 */
export function startDataGridColumnResize<TData extends RowData>(
	event: DataGridResizeStartEvent,
	header: DataGridHeader<TData>,
	live: boolean,
	autoSize: DataGridAutoSizeController,
): (() => void) | undefined {
	const table = header.column.table;
	const column = table.getColumn(header.column.id);
	if (column?.getCanResize() !== true) {
		return undefined;
	}
	const isTouchSession = isDataGridTouchEvent(event);
	if (isTouchSession && event.touches.length > 1) {
		return undefined;
	}

	const { ownerDocument } = event.currentTarget;
	const ownerWindow = ownerDocument.defaultView;
	const previousBodyCursor = ownerDocument.body.style.cursor;
	const previousDocumentCursor = ownerDocument.documentElement.style.cursor;
	const startSize = header.getSize();
	const touchIdentifier = isTouchSession ? firstTouch(event.touches)?.identifier : undefined;
	const dragStartClientX = getDataGridResizeEventClientX(event, touchIdentifier);
	const headerCell = event.currentTarget.closest("th");
	const headerRect = headerCell?.getBoundingClientRect();
	const liveTableElement = live ? (headerCell?.closest("table") ?? null) : null;
	const liveViewportElement = liveTableElement?.closest<HTMLElement>('[data-slot="data-grid-table-viewport"]') ?? null;
	const liveViewportWidthIsComputed = liveViewportElement?.style.width.startsWith("calc(") ?? false;
	const liveContainerWidth = liveViewportElement === null ? 0 : getDataGridTableFillMeasurementTarget(liveViewportElement).clientWidth;
	const totalSizeStart = table.getTotalSize();
	const fillColumnId = table.getVisibleLeafColumns().find((visibleColumn) => visibleColumn.columnDef.meta?.fillWidth === true)?.id;
	const leafColumns = getDataGridHeaderLeafColumns(header);
	const [firstLeaf] = leafColumns;
	const resizeRtl = isMirroredResize(table, firstLeaf ?? column);
	const anchorEdge = headerRect === undefined ? undefined : resizeRtl ? headerRect.left : headerRect.right;
	const startOffset = anchorEdge !== undefined && Number.isFinite(anchorEdge) ? anchorEdge : dragStartClientX;

	if (dragStartClientX === undefined || startOffset === undefined) {
		return undefined;
	}

	ownerDocument.body.style.cursor = "col-resize";
	ownerDocument.documentElement.style.cursor = "col-resize";

	const columnSizingStart = leafColumns.map((leafColumn): [string, number] => [leafColumn.id, leafColumn.getSize()]);
	// Group and merged header cells size from their own variables, which must follow their leaves through a live drag too.
	const liveSpanningHeaders =
		liveTableElement === null
			? []
			: getDataGridTableAllFlatHeaders(table)
					.filter((flatHeader) => flatHeader.subHeaders.length > 0)
					.map((flatHeader) => ({
						id: flatHeader.id,
						leaves: getDataGridHeaderLeafColumns(flatHeader).map((leafColumn): [string, number] => [leafColumn.id, leafColumn.getSize()]),
					}));
	const directionMultiplier = resizeRtl ? -1 : 1;
	const deltaBounds = getResizeDeltaBounds(table, columnSizingStart);

	let lastClientX = dragStartClientX;
	let ended = false;
	let autoSizePreview: { readonly columnId: string; readonly size: number } | null = null;
	const stopListeners: (() => void)[] = [];

	const writeLiveSizes = (tableElement: HTMLTableElement, nextColumnSizing: ColumnSizingState): void => {
		let totalSize = totalSizeStart;
		for (const [columnId, headerSize] of columnSizingStart) {
			const nextSize = nextColumnSizing[columnId];
			if (nextSize !== undefined) {
				totalSize += nextSize - headerSize;
				tableElement.style.setProperty(`--col-${columnId}-size`, liveColumnSizeValue(columnId, nextSize, fillColumnId));
				tableElement.style.setProperty(`--header-${columnId}-size`, String(nextSize));
			}
		}
		// An armed meta.autoSize column would reflow after the commit and move
		// every column past it, so its reflow is previewed here and committed with the drag.
		const preview = autoSize.preview(liveContainerWidth - totalSize);
		autoSizePreview = preview !== null && !(preview.columnId in nextColumnSizing) ? preview : null;
		if (autoSizePreview !== null && preview !== null) {
			totalSize += preview.size - preview.current;
			tableElement.style.setProperty(`--col-${preview.columnId}-size`, liveColumnSizeValue(preview.columnId, preview.size, fillColumnId));
			tableElement.style.setProperty(`--header-${preview.columnId}-size`, String(preview.size));
		}
		for (const spanningHeader of liveSpanningHeaders) {
			let size = 0;
			for (const [columnId, leafStartSize] of spanningHeader.leaves) {
				size += nextColumnSizing[columnId] ?? (autoSizePreview?.columnId === columnId ? autoSizePreview.size : leafStartSize);
			}
			tableElement.style.setProperty(`--header-${spanningHeader.id}-size`, String(size));
		}
		const width = `calc(${String(totalSize)}px + var(--data-grid-fill-size, 0px))`;
		tableElement.style.width = width;
		if (liveViewportElement !== null) {
			if (liveViewportWidthIsComputed) {
				liveViewportElement.style.width = width;
			}
			const fill = Math.max(0, liveContainerWidth - totalSize);
			liveViewportElement.style.setProperty("--data-grid-fill-size", `${String(fill)}px`);
			liveViewportElement.style.setProperty("--data-grid-fill", String(fill));
		}
	};

	const updateOffset = (clientXPos: number | undefined, commit: boolean): void => {
		if (clientXPos === undefined) {
			return;
		}
		lastClientX = clientXPos;
		const deltaPercentage = Math.min(Math.max(((clientXPos - dragStartClientX) * directionMultiplier) / startSize, deltaBounds.min), deltaBounds.max);
		const deltaOffset = deltaPercentage * startSize;
		const nextColumnSizing: ColumnSizingState = {};
		for (const [columnId, headerSize] of columnSizingStart) {
			nextColumnSizing[columnId] = Math.round(Math.max(headerSize + headerSize * deltaPercentage, 0) * SIZE_ROUNDING_FACTOR) / SIZE_ROUNDING_FACTOR;
		}

		if (liveTableElement === null) {
			table.setColumnResizing((old) => ({
				...old,
				startOffset,
				startSize,
				deltaOffset,
				deltaPercentage,
				columnSizingStart,
				isResizingColumn: column.id,
			}));
		} else {
			writeLiveSizes(liveTableElement, nextColumnSizing);
		}

		if (commit) {
			const committed = autoSizePreview === null ? nextColumnSizing : { ...nextColumnSizing, [autoSizePreview.columnId]: autoSizePreview.size };
			if (autoSizePreview !== null) {
				autoSize.adopt(autoSizePreview.columnId, autoSizePreview.size);
			}
			table.setColumnSizing((old) => ({ ...old, ...committed }));
		}
	};

	// Single teardown path, safe to call more than once (blur + mouseup + unmount can race).
	const endResize = (clientXPos: number | undefined): void => {
		if (ended) {
			return;
		}
		ended = true;
		for (const stop of stopListeners) {
			stop();
		}
		updateOffset(clientXPos, true);
		table.setColumnResizing((old) => ({
			...old,
			isResizingColumn: false,
			startOffset: null,
			startSize: null,
			deltaOffset: null,
			deltaPercentage: null,
			columnSizingStart: [],
		}));
		ownerDocument.body.style.cursor = previousBodyCursor;
		ownerDocument.documentElement.style.cursor = previousDocumentCursor;
	};

	const mouseMoveHandler = (moveEvent: MouseEvent): void => {
		updateOffset(moveEvent.clientX, false);
	};
	const mouseUpHandler = (upEvent: MouseEvent): void => {
		endResize(upEvent.clientX);
	};
	const touchMoveHandler = (moveEvent: TouchEvent): void => {
		if (moveEvent.cancelable) {
			moveEvent.preventDefault();
			moveEvent.stopPropagation();
		}
		updateOffset(getDataGridResizeEventClientX(moveEvent, touchIdentifier), false);
	};
	const touchEndHandler = (endEvent: TouchEvent): void => {
		// Only the initiating touch ends the drag.
		const clientXPos = touchIdentifier === undefined ? getDataGridResizeEventClientX(endEvent) : findTouchClientX(endEvent.changedTouches, touchIdentifier);
		if (clientXPos === undefined) {
			return;
		}
		if (endEvent.cancelable) {
			endEvent.preventDefault();
			endEvent.stopPropagation();
		}
		endResize(clientXPos);
	};
	// Interrupted gestures and focus loss would otherwise leave the session live with no pointer held.
	const interruptHandler = (): void => {
		endResize(lastClientX);
	};

	if (isTouchSession) {
		ownerDocument.addEventListener("touchmove", touchMoveHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("touchend", touchEndHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("touchcancel", interruptHandler);
		stopListeners.push((): void => {
			ownerDocument.removeEventListener("touchmove", touchMoveHandler);
			ownerDocument.removeEventListener("touchend", touchEndHandler);
			ownerDocument.removeEventListener("touchcancel", interruptHandler);
		});
	} else {
		ownerDocument.addEventListener("mousemove", mouseMoveHandler, NON_PASSIVE_LISTENER);
		ownerDocument.addEventListener("mouseup", mouseUpHandler, NON_PASSIVE_LISTENER);
		stopListeners.push((): void => {
			ownerDocument.removeEventListener("mousemove", mouseMoveHandler);
			ownerDocument.removeEventListener("mouseup", mouseUpHandler);
		});
	}
	if (ownerWindow !== null) {
		ownerWindow.addEventListener("blur", interruptHandler);
		stopListeners.push((): void => {
			ownerWindow.removeEventListener("blur", interruptHandler);
		});
	}

	table.setColumnResizing((old) => ({
		...old,
		startOffset,
		startSize,
		deltaOffset: 0,
		deltaPercentage: 0,
		columnSizingStart,
		isResizingColumn: column.id,
	}));

	return (): void => {
		endResize(lastClientX);
	};
}

// ── TData-free table reads (context visitors) ──────────────────────────────

export const HAS_FILL_COLUMN_VISITOR: DataGridGridVisitor<boolean> = { visit: (grid) => hasDataGridFillColumn(grid.table) };
