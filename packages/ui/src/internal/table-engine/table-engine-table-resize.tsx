"use client";

// Column resizing for the data grid table (enhancement 8.1: split from table-engine-table.tsx): pointer, keyboard and the live size vars.

import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	type TableEngineAutoSizeController,
	type TableEngineColumn,
	type TableEngineCoreTable,
	type TableEngineGridVisitor,
	type TableEngineResolvedTableLayout,
} from "./table-engine";
import { type ColumnSizingState, type RowData } from "@tanstack/react-table";
import * as React from "react";
import {
	type TableEngineHeader,
	type TableEngineStyle,
	NON_PASSIVE_LISTENER,
	RESIZE_MIN_DELTA_RATIO,
	SIZE_ROUNDING_FACTOR,
	getTableEngineHeaderLeafColumns,
	getTableEngineTableAllFlatHeaders,
	getTableEngineTableFillMeasurementTarget,
	columnSizeValue,
	hasTableEngineFillColumn,
	resolveTableEngineFillShares,
} from "./table-engine-table-layout";

/**
 * TanStack's own default, restated: v9 resolves feature defaults internally
 * and may leave the option unset on the instance.
 */
export const TABLE_ENGINE_DEFAULT_COLUMN_RESIZE_MODE = "onEnd";

/** How tall a live drag's guide line is: from the header's top to the table's foot, set on the table for the drag. */
export const RESIZE_GUIDE_VARIABLE = "--table-engine-resize-guide";

/** A live drag over a table whose columns share its spare width, in the widths the columns are drawn at. */
export interface DrawnResizeInput {
	/** Every visible column's drawn width as the drag starts: its size plus its share of the spare width. */
	readonly drawn: ReadonlyMap<string, number>;
	/** Every visible column's own size: a column that gives up width never goes below it. */
	readonly sizes: ReadonlyMap<string, number>;
	/** The column (or a group's leaves) being dragged. */
	readonly dragged: readonly string[];
	/** The columns after the dragged edge that take up the difference, so the edge follows the pointer. */
	readonly absorbers: readonly string[];
	/** How far the edge has moved, in pixels: positive grows the dragged column. */
	readonly delta: number;
}

/**
 * The columns' drawn widths for a live drag. The dragged column grows or shrinks by `delta`, so its edge follows the
 * pointer one to one; the columns after the edge take up the difference, each by its width (giving width back only
 * down to its own size; past that the table grows wider and scrolls). Every other column keeps its drawn width.
 */
export function drawnResizeWidths({ drawn, sizes, dragged, absorbers, delta }: DrawnResizeInput): Map<string, number> {
	const widths = new Map(drawn);
	const draggedStart = dragged.reduce((total, id) => total + (drawn.get(id) ?? 0), 0);
	const draggedEnd = Math.max(0, draggedStart + delta);
	for (const id of dragged) {
		const start = drawn.get(id) ?? 0;
		widths.set(id, draggedStart > 0 ? (start * draggedEnd) / draggedStart : draggedEnd / dragged.length);
	}
	const applied = draggedEnd - draggedStart;
	if (applied > 0) {
		// The dragged column grew: the columns after it give back the room they were given, never more.
		const slack = absorbers.map((id): [string, number] => [id, Math.max(0, (drawn.get(id) ?? 0) - (sizes.get(id) ?? 0))]);
		const totalSlack = slack.reduce((total, [, value]) => total + value, 0);
		const taken = Math.min(applied, totalSlack);
		for (const [id, value] of slack) {
			if (totalSlack > 0) {
				widths.set(id, (drawn.get(id) ?? 0) - (taken * value) / totalSlack);
			}
		}
	} else if (applied < 0) {
		// The dragged column shrank: the columns after it take the room, each by its width.
		const absorbersWidth = absorbers.reduce((total, id) => total + (drawn.get(id) ?? 0), 0);
		for (const id of absorbers) {
			if (absorbersWidth > 0) {
				const start = drawn.get(id) ?? 0;
				widths.set(id, start + (-applied * start) / absorbersWidth);
			}
		}
	}
	return widths;
}

export function isOnEndResizeMode<TData extends RowData>(layout: TableEngineResolvedTableLayout, table: TableEngineCoreTable<TData>): boolean {
	return (layout.columnsResizeMode ?? table.options.columnResizeMode ?? TABLE_ENGINE_DEFAULT_COLUMN_RESIZE_MODE) === TABLE_ENGINE_DEFAULT_COLUMN_RESIZE_MODE;
}

/** End-pinned columns grow from their start edge, so their geometry runs mirrored, like RTL. */
export function isMirroredResize<TData extends RowData>(table: TableEngineCoreTable<TData>, column: TableEngineColumn<TData>): boolean {
	return (table.options.columnResizeDirection === "rtl") !== (column.getIsPinned() === "end");
}

/** The column-size CSS variables of every rendered header (`--header-x-size`, `--col-x-size`). */
export function getTableEngineColumnSizeVars<TData extends RowData>(table: TableEngineCoreTable<TData>): TableEngineStyle {
	const fillShares = resolveTableEngineFillShares(table);
	const vars: TableEngineStyle = {};
	for (const header of getTableEngineTableAllFlatHeaders(table)) {
		vars[`--header-${header.id}-size`] = header.getSize();
		vars[`--col-${header.column.id}-size`] = fillShares.has(header.column.id)
			? columnSizeValue(header.column.id, header.column.getSize(), fillShares)
			: header.column.getSize();
	}
	return vars;
}

// ── Column resize session ──────────────────────────────────────────────────

export type TableEngineResizeStartEvent = React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>;

export type TableEngineResizeDocumentEvent = MouseEvent | TouchEvent;

export interface TableEngineTouchPoint {
	readonly identifier: number;
	readonly clientX: number;
}

export interface TableEngineTouchListLike {
	readonly length: number;
	item(index: number): TableEngineTouchPoint | null;
}

export function isTableEngineTouchEvent(event: TableEngineResizeStartEvent | TableEngineResizeDocumentEvent): event is React.TouchEvent<HTMLElement> | TouchEvent {
	return "touches" in event;
}

export function findTouchClientX(list: TableEngineTouchListLike, identifier: number): number | undefined {
	for (let index = 0; index < list.length; index++) {
		const touch = list.item(index);
		if (touch?.identifier === identifier) {
			return touch.clientX;
		}
	}
	return undefined;
}

export function firstTouch(list: TableEngineTouchListLike): TableEngineTouchPoint | undefined {
	return list.length > 0 ? (list.item(LIST_SLOT_INDEX.first) ?? undefined) : undefined;
}

export function getTableEngineResizeEventClientX(event: TableEngineResizeStartEvent | TableEngineResizeDocumentEvent, touchIdentifier?: number): number | undefined {
	if (!isTableEngineTouchEvent(event)) {
		return event.clientX;
	}
	if (touchIdentifier !== undefined) {
		return findTouchClientX(event.touches, touchIdentifier) ?? findTouchClientX(event.changedTouches, touchIdentifier);
	}
	return firstTouch(event.touches)?.clientX ?? firstTouch(event.changedTouches)?.clientX;
}

/** The min/max delta ratio a drag may reach, from the leaves' resolved min/max sizes. */
export function getResizeDeltaBounds<TData extends RowData>(
	table: TableEngineCoreTable<TData>,
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

/**
 * Starts a column resize drag. `live` (onChange mode) writes per-move widths
 * straight to the table element's `--col/--header` variables — zero React
 * renders during the drag — and commits sizing state once at release; onEnd
 * mode tracks the drag in `columnResizing` state for the indicator and
 * commits at release. Returns a teardown that ends the session.
 */
export function startTableEngineColumnResize<TData extends RowData>(
	event: TableEngineResizeStartEvent,
	header: TableEngineHeader<TData>,
	live: boolean,
	autoSize: TableEngineAutoSizeController,
): (() => void) | undefined {
	const table = header.column.table;
	const column = table.getColumn(header.column.id);
	if (column?.getCanResize() !== true) {
		return undefined;
	}
	const isTouchSession = isTableEngineTouchEvent(event);
	if (isTouchSession && event.touches.length > 1) {
		return undefined;
	}

	const { ownerDocument } = event.currentTarget;
	const ownerWindow = ownerDocument.defaultView;
	const previousBodyCursor = ownerDocument.body.style.cursor;
	const previousDocumentCursor = ownerDocument.documentElement.style.cursor;
	const startSize = header.getSize();
	const touchIdentifier = isTouchSession ? firstTouch(event.touches)?.identifier : undefined;
	const dragStartClientX = getTableEngineResizeEventClientX(event, touchIdentifier);
	const headerCell = event.currentTarget.closest("th");
	const headerRect = headerCell?.getBoundingClientRect();
	const liveTableElement = live ? (headerCell?.closest("table") ?? null) : null;
	const liveViewportElement = liveTableElement?.closest<HTMLElement>('[data-slot="table-engine-table-viewport"]') ?? null;
	const liveViewportWidthIsComputed = liveViewportElement?.style.width.startsWith("calc(") ?? false;
	// A live drag draws its guide from the handle down to the table's foot: measured once, for the whole drag.
	if (liveTableElement !== null && headerRect !== undefined) {
		liveTableElement.style.setProperty(RESIZE_GUIDE_VARIABLE, `${String(liveTableElement.getBoundingClientRect().bottom - headerRect.top)}px`);
	}
	const liveContainerWidth = liveViewportElement === null ? 0 : getTableEngineTableFillMeasurementTarget(liveViewportElement).clientWidth;
	const totalSizeStart = table.getTotalSize();
	// The shares as the drag starts: they still add up to 1 as sizes change, so the table keeps spanning its container.
	const fillShares = resolveTableEngineFillShares(table);
	const leafColumns = getTableEngineHeaderLeafColumns(header);
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
			: getTableEngineTableAllFlatHeaders(table)
					.filter((flatHeader) => flatHeader.subHeaders.length > 0)
					.map((flatHeader) => ({
						id: flatHeader.id,
						leaves: getTableEngineHeaderLeafColumns(flatHeader).map((leafColumn): [string, number] => [leafColumn.id, leafColumn.getSize()]),
					}));
	const directionMultiplier = resizeRtl ? -1 : 1;
	const deltaBounds = getResizeDeltaBounds(table, columnSizingStart);

	// A live drag over columns that share the spare width works in the widths they are DRAWN at: the dragged edge
	// follows the pointer and the columns after it take up the difference, then release keeps every width as drawn
	// (nothing jumps). An armed meta.autoSize column has its own reflow, so it keeps the plain path below.
	const visibleLeaves = table.getVisibleLeafColumns();
	const fillStart = Math.max(0, liveContainerWidth - totalSizeStart);
	const drawnStart = new Map(visibleLeaves.map((leaf): [string, number] => [leaf.id, leaf.getSize() + fillStart * (fillShares.get(leaf.id) ?? 0)]));
	const ownSizes = new Map(visibleLeaves.map((leaf): [string, number] => [leaf.id, leaf.getSize()]));
	const draggedIds = leafColumns.map((leaf) => leaf.id);
	const lastDraggedPosition = Math.max(...draggedIds.map((id) => visibleLeaves.findIndex((leaf) => leaf.id === id)));
	const absorberIds = visibleLeaves
		.slice(lastDraggedPosition + 1)
		.filter((leaf) => fillShares.has(leaf.id))
		.map((leaf) => leaf.id);
	const drawnDraggedStart = draggedIds.reduce((total, id) => total + (drawnStart.get(id) ?? 0), 0);
	const drawsAsShown = liveTableElement !== null && fillShares.size > 0 && absorberIds.length > 0 && autoSize.preview(liveContainerWidth - totalSizeStart) === null;

	const writeDrawnSizes = (tableElement: HTMLTableElement, widths: ReadonlyMap<string, number>): void => {
		let total = 0;
		for (const [columnId, width] of widths) {
			total += width;
			tableElement.style.setProperty(`--col-${columnId}-size`, String(width));
			tableElement.style.setProperty(`--header-${columnId}-size`, String(width));
		}
		for (const spanningHeader of liveSpanningHeaders) {
			const size = spanningHeader.leaves.reduce((sum, [columnId, leafStartSize]) => sum + (widths.get(columnId) ?? leafStartSize), 0);
			tableElement.style.setProperty(`--header-${spanningHeader.id}-size`, String(size));
		}
		// The widths already hold the spare width, so nothing is left to fill.
		const width = `${String(total)}px`;
		tableElement.style.width = width;
		if (liveViewportElement !== null) {
			if (liveViewportWidthIsComputed) {
				liveViewportElement.style.width = width;
			}
			liveViewportElement.style.setProperty("--table-engine-fill-size", "0px");
			liveViewportElement.style.setProperty("--table-engine-fill", "0");
		}
	};

	const updateDrawnOffset = (clientXPos: number, commit: boolean): void => {
		const deltaPercentage = Math.min(Math.max(((clientXPos - dragStartClientX) * directionMultiplier) / drawnDraggedStart, deltaBounds.min), deltaBounds.max);
		const widths = drawnResizeWidths({ drawn: drawnStart, sizes: ownSizes, dragged: draggedIds, absorbers: absorberIds, delta: deltaPercentage * drawnDraggedStart });
		if (liveTableElement !== null) {
			writeDrawnSizes(liveTableElement, widths);
		}
		if (commit) {
			const committed: ColumnSizingState = {};
			for (const [columnId, width] of widths) {
				committed[columnId] = Math.round(width * SIZE_ROUNDING_FACTOR) / SIZE_ROUNDING_FACTOR;
			}
			table.setColumnSizing((old) => ({ ...old, ...committed }));
		}
	};

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
				tableElement.style.setProperty(`--col-${columnId}-size`, columnSizeValue(columnId, nextSize, fillShares));
				tableElement.style.setProperty(`--header-${columnId}-size`, String(nextSize));
			}
		}
		// An armed meta.autoSize column would reflow after the commit and move
		// every column past it, so its reflow is previewed here and committed with the drag.
		const preview = autoSize.preview(liveContainerWidth - totalSize);
		autoSizePreview = preview !== null && !(preview.columnId in nextColumnSizing) ? preview : null;
		if (autoSizePreview !== null && preview !== null) {
			totalSize += preview.size - preview.current;
			tableElement.style.setProperty(`--col-${preview.columnId}-size`, columnSizeValue(preview.columnId, preview.size, fillShares));
			tableElement.style.setProperty(`--header-${preview.columnId}-size`, String(preview.size));
		}
		for (const spanningHeader of liveSpanningHeaders) {
			let size = 0;
			for (const [columnId, leafStartSize] of spanningHeader.leaves) {
				size += nextColumnSizing[columnId] ?? (autoSizePreview?.columnId === columnId ? autoSizePreview.size : leafStartSize);
			}
			tableElement.style.setProperty(`--header-${spanningHeader.id}-size`, String(size));
		}
		const width = `calc(${String(totalSize)}px + var(--table-engine-fill-size, 0px))`;
		tableElement.style.width = width;
		if (liveViewportElement !== null) {
			if (liveViewportWidthIsComputed) {
				liveViewportElement.style.width = width;
			}
			const fill = Math.max(0, liveContainerWidth - totalSize);
			liveViewportElement.style.setProperty("--table-engine-fill-size", `${String(fill)}px`);
			liveViewportElement.style.setProperty("--table-engine-fill", String(fill));
		}
	};

	const updateOffset = (clientXPos: number | undefined, commit: boolean): void => {
		if (clientXPos === undefined) {
			return;
		}
		lastClientX = clientXPos;
		if (drawsAsShown) {
			updateDrawnOffset(clientXPos, commit);
			return;
		}
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
		liveTableElement?.style.removeProperty(RESIZE_GUIDE_VARIABLE);
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
		updateOffset(getTableEngineResizeEventClientX(moveEvent, touchIdentifier), false);
	};
	const touchEndHandler = (endEvent: TouchEvent): void => {
		// Only the initiating touch ends the drag.
		const clientXPos = touchIdentifier === undefined ? getTableEngineResizeEventClientX(endEvent) : findTouchClientX(endEvent.changedTouches, touchIdentifier);
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

export const HAS_FILL_COLUMN_VISITOR: TableEngineGridVisitor<boolean> = { visit: (grid) => hasTableEngineFillColumn(grid.table) };
