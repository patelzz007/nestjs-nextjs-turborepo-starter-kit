"use client";

// ============================================================
// internal/spreadsheet/cell-selection.tsx
//
// The spreadsheet layer of the data grid: a headless controller that adds
// keyboard navigation, clipboard copy / cut / paste (TSV + HTML), clear,
// type-to-edit, a built-in free-text editor and the fill-handle drag to a
// grid whose `tableLayout.cellSelection` is on. Mount it once inside
// `<TableEngine>`, next to the table. Selection state itself is TanStack v9's
// `cellSelectionFeature` (registered by `tableEngineFeatures`); this module
// never owns data — every write reaches the consumer as ONE
// `onCellsChange` batch per operation.
//
// The listeners attach to the grid's own body viewport, whose table receives
// DOM focus (the container-focus model with `aria-activedescendant`), so a
// virtualized row unmounting can never strand `document.activeElement`.
// ============================================================

import { hasGlobalConstructor, LIST_SLOT_INDEX } from "@workspace/shared";
import {
	useTableEngine,
	type TableEngineCellAddress,
	type TableEngineCellEditRequest,
	type TableEngineCellsChangeDetails,
	type TableEngineCoreTable,
	type TableEngineGridVisitor,
	type TableEngineLayoutProps,
	type TableEngineTypedGrid,
} from "../table-engine/table-engine";
import type { RowData } from "@tanstack/react-table";
import * as React from "react";
import {
	getTableEngineDisplayOrderedColumns,
	getTableEngineWritableCellEdit,
	isSelectableColumn,
	parseTableEngineClipboardText,
	renderTableEngineClipboardHtml,
	serializeTableEngineClipboardText,
} from "./cell-selection-clipboard";
import { TableEngineCellEditorOverlay, buildTableEngineEditDetails, findTableEngineBodyViewport, validateTableEngineEdit } from "./cell-selection-editor";
import { startTableEngineFillSession } from "./cell-selection-fill";
import {
	type TableEngineCellSelectionApi,
	type TableEngineClipboardWrite,
	type TableEngineEditorAdvance,
	type TableEngineEditorSession,
	type TableEngineFocusCellOptions,
	type TableEngineJumpColumnTarget,
	type TableEngineJumpRowTarget,
	type TableEngineStepDirection,
	FOCUSED_CELL_SELECTOR,
	FOCUS_RETRY_ATTEMPTS,
	FOCUS_RETRY_DELAY_MS,
	GRID_TABLE_SELECTOR,
	HALF,
	KEY_DIRECTIONS,
	PAGE_JUMP_FALLBACK_ROWS,
	PRINTABLE_KEY_LENGTH,
	ROW_SELECTOR,
	buildTableEngineClearDetails,
	buildTableEngineEditorSession,
	buildTableEnginePasteDetails,
	closestElement,
	extendTableEngineSelection,
	findTableEngineCellElement,
	findTableEngineScroller,
	getTableEngineActiveBound,
	getTableEngineActiveCorner,
	getTableEngineActiveRegionGrid,
	getTableEngineBoundKey,
	getTableEngineDomRowIds,
	getTableEngineRenderedRowIds,
	getTableEngineStepTarget,
	getTableEngineVisibleSelectedCellCount,
	isChord,
	isTableEngineEditableTarget,
	isTableEngineInteractiveKeyTarget,
	mirrorTableEngineDirection,
	resolveTableEngineJumpRowIndex,
	scrollTableEngineCellIntoView,
	selectTableEngineRegion,
	toSnapshotBound,
} from "./cell-selection-model";

export { TableEngineSelectionBar, type TableEngineSelectionBarProps, tableEngineSelectionBarVariants } from "./cell-selection-bar";
export { parseTableEngineClipboardText, serializeTableEngineClipboardText, stringifyTableEngineCellValue, tileTableEngineClipboardBlock } from "./cell-selection-clipboard";
export {
	type TableEngineCellSelectionApi,
	type TableEngineClearSource,
	type TableEngineFocusCellOptions,
	type TableEnginePasteResult,
	type TableEnginePasteTarget,
	buildTableEngineClearDetails,
	buildTableEnginePasteDetails,
	getTableEngineActiveRegionGrid,
	getTableEngineVisibleSelectedCellCount,
	invertTableEngineCellsChange,
} from "./cell-selection-model";

// ── Constants ──────────────────────────────────────────────────────────────

interface TableEngineCellSelectionAttachOptions<TData extends RowData> {
	readonly viewport: HTMLElement;
	readonly keyboard: boolean;
	readonly clipboard: boolean;
	/** Latest typed grid (table + write callbacks), read at event time. */
	readonly getGrid: () => TableEngineTypedGrid<TData>;
	/** Latest TData-free grid props, read at event time. */
	readonly getProps: () => TableEngineLayoutProps;
	readonly openEditor: (session: TableEngineEditorSession) => void;
	readonly registerApi: (api: TableEngineCellSelectionApi | null) => void;
}

/**
 * Wires every listener onto one body viewport and returns the teardown.
 * Plain imperative code on purpose: it reads the latest table and props
 * through the getters, so React re-renders never re-attach it.
 */
function attachTableEngineCellSelection<TData extends RowData>({
	viewport,
	keyboard,
	clipboard,
	getGrid,
	getProps,
	openEditor,
	registerApi,
}: TableEngineCellSelectionAttachOptions<TData>): () => void {
	const getTable = (): TableEngineCoreTable<TData> => getGrid().table;
	const getOnCellsChange = (): ((details: TableEngineCellsChangeDetails<TData>) => void) | undefined => getGrid().onCellsChange;
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
		ownerWindow.requestAnimationFrame((): void => {
			// A grid that left the page before the frame ran has nothing to focus or scroll.
			if (viewport.isConnected) {
				callback();
			}
		});
	};

	const scrollFocusedIntoView = (targetRowIndex?: number, rowCount?: number, explicitCell?: TableEngineCellAddress): void => {
		const queryScrollCell = (): Element | null =>
			explicitCell === undefined ? viewport.querySelector(FOCUSED_CELL_SELECTOR) : findTableEngineCellElement(viewport, explicitCell.rowId, explicitCell.columnId);
		// After the atom write React still has to commit the data attributes;
		// a frame lands after that commit.
		nextFrame((): void => {
			const cell = queryScrollCell();
			syncActiveDescendant();
			if (cell !== null || targetRowIndex === undefined || rowCount === undefined || rowCount === 0) {
				scrollTableEngineCellIntoView(cell);
				return;
			}
			// Virtualization: the jump target is not mounted. The spacer rows keep
			// scrollHeight proportional to the row count, so estimate the offset,
			// let the virtualizer mount the region, then finish precisely.
			const scroller = findTableEngineScroller(viewport);
			if (scroller === null) {
				return;
			}
			scroller.scrollTop = ((targetRowIndex + HALF) / rowCount) * scroller.scrollHeight - scroller.clientHeight * HALF;
			nextFrame((): void => {
				scrollTableEngineCellIntoView(queryScrollCell());
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
		const cellEdit = getTableEngineWritableCellEdit(cell.column, cell.row.original);
		if (cellEdit !== null) {
			const session = buildTableEngineEditorSession(cell, cellEdit, initialText);
			if (session !== null) {
				openEditor(session);
				return true;
			}
			const { onCellEditRequest } = getGrid();
			if (onCellEditRequest !== undefined) {
				const request: TableEngineCellEditRequest<TData> = { rowId: cell.row.id, columnId: cell.column.id, row: cell.row.original, previousValue: cell.getValue() };
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
	const focusCell = (rowId: string, columnId: string, options?: TableEngineFocusCellOptions): void => {
		clearTimeout(focusRetryTimer);
		let attempts = FOCUS_RETRY_ATTEMPTS;
		const attempt = (): void => {
			if (!viewport.isConnected) {
				return;
			}
			const cell = findTableEngineCellElement(viewport, rowId, columnId);
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
			scrollTableEngineCellIntoView(cell);
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
			scrollTableEngineCellIntoView(findTableEngineCellElement(viewport, rowId, columnId));
		},
	});

	// Jump targets (Home, End, Ctrl+Arrows, PageUp/PageDown) in display-index
	// space: plain jumps collapse to the target, Shift jumps keep the active
	// range's opposite corner as the anchor.
	const jumpFocus = (rowTarget: TableEngineJumpRowTarget, columnTarget: TableEngineJumpColumnTarget, extend: boolean): boolean => {
		const table = getTable();
		const focused = table.getFocusedCell();
		if (focused === undefined) {
			return false;
		}
		const rows = table.getRowsInDisplayOrder();
		const allColumns = getTableEngineDisplayOrderedColumns(table);
		const selectable = allColumns.filter((column) => isSelectableColumn(column));
		if (rows.length === 0 || selectable.length === 0) {
			return false;
		}
		const rowIndex = focused.row.getDisplayIndex();
		let clampedRowIndex = resolveTableEngineJumpRowIndex(rowTarget, rowIndex, rows.length);
		// Walk the target back toward the focus until it lands on a rendered row,
		// so a jump never focuses an off-page row.
		const rendered = getTableEngineRenderedRowIds(table, viewport);
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
			const corner = getTableEngineActiveCorner(table);
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
	const moveFocusVisual = (direction: TableEngineStepDirection): void => {
		const table = getTable();
		const focused = table.getFocusedCell();
		const target = focused === undefined ? null : getTableEngineStepTarget(table, viewport, { rowId: focused.row.id, columnId: focused.column.id }, direction);
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
		const scroller = findTableEngineScroller(viewport);
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

	const writeSelectionToClipboard = async (): Promise<TableEngineClipboardWrite | null> => {
		const grid = getTableEngineActiveRegionGrid(getTable(), viewport);
		if (grid === null) {
			return null;
		}
		const text = serializeTableEngineClipboardText(grid);
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
						"text/html": new Blob([renderTableEngineClipboardHtml(grid)], { type: "text/html" }),
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
		const details = buildTableEngineClearDetails(getTable(), "cut", true, viewport);
		if (details !== null) {
			onCellsChange(details);
		}
	};

	const handleArrowKey = (event: KeyboardEvent, direction: TableEngineStepDirection): void => {
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
			const lastRenderedId = getTableEngineDomRowIds(viewport).at(-1);
			if (focused !== undefined && focused.row.id === lastRenderedId && focusFirstIn(getAppendedRows().at(LIST_SLOT_INDEX.first))) {
				event.preventDefault();
				return;
			}
		}
		event.preventDefault();
		if (extend) {
			const corner = extendTableEngineSelection(table, viewport, direction);
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
		if (isTableEngineInteractiveKeyTarget(event.target)) {
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
			handleArrowKey(event, mirrorTableEngineDirection(arrowDirection, getComputedStyle(viewport).direction === "rtl"));
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
				const details = buildTableEngineClearDetails(table, "clear", false, viewport);
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
		const grid = getTableEngineActiveRegionGrid(getTable(), viewport);
		const data = event.clipboardData;
		if (grid === null || data === null) {
			return false;
		}
		event.preventDefault();
		const text = serializeTableEngineClipboardText(grid);
		data.setData("text/plain", text);
		data.setData("text/html", renderTableEngineClipboardHtml(grid));
		getProps().onCellsCopy?.({ text, grid, cut });
		return true;
	};

	const handleCopy = (event: ClipboardEvent): void => {
		if (!isTableEngineEditableTarget(event.target)) {
			copySelection(event, false);
		}
	};

	const handleCut = (event: ClipboardEvent): void => {
		if (!isTableEngineEditableTarget(event.target) && copySelection(event, true)) {
			dispatchCut();
		}
	};

	const handlePaste = (event: ClipboardEvent): void => {
		if (isTableEngineEditableTarget(event.target)) {
			return;
		}
		const onCellsChange = getOnCellsChange();
		const text = event.clipboardData?.getData("text/plain") ?? "";
		if (onCellsChange === undefined || text === "") {
			return;
		}
		event.preventDefault();
		const table = getTable();
		const result = buildTableEnginePasteDetails(table, parseTableEngineClipboardText(text), viewport);
		if (result === null) {
			return;
		}
		onCellsChange(result.details);
		// The pasted region becomes the selection; single mode keeps the focused cell.
		if (isRangeSelectionEnabled()) {
			selectTableEngineRegion(table, result.target);
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
	const getSelectionKey = (): string => `${String(getTable().getSelectedCellCount())}:${getTableEngineBoundKey(getTable())}`;
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
		if (closestElement(event.target, '[data-slot="table-engine-cell-fill-handle"]') === null) {
			return;
		}
		// Ahead of React's root delegation, so the td underneath never starts a range drag.
		event.preventDefault();
		event.stopPropagation();
		startTableEngineFillSession({ table: getTable(), viewport, onCellsChange: getOnCellsChange() });
	};

	const isFocusedCellTarget = (target: EventTarget | null): boolean => closestElement(target, "td")?.hasAttribute("data-cell-focused") === true;

	// Single-click editing (opt-in): a plain click on the focused cell edits it.
	const handleClickToEdit = (event: MouseEvent): void => {
		if (getProps().tableLayout.cellEditMode !== "click" || event.shiftKey || event.ctrlKey || event.metaKey || isTableEngineInteractiveKeyTarget(event.target)) {
			return;
		}
		if (isFocusedCellTarget(event.target)) {
			requestCellEdit();
		}
	};

	// Double-click opens the editor on the cell the first click focused.
	const handleDoubleClick = (event: MouseEvent): void => {
		if (!isTableEngineInteractiveKeyTarget(event.target) && isFocusedCellTarget(event.target)) {
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
		const activeBound = getTableEngineActiveBound(table);
		onCellSelectionChange({
			focused: focusedCell === undefined ? null : { rowId: focusedCell.row.id, columnId: focusedCell.column.id },
			bounds: table.getCellSelectionBounds().map(toSnapshotBound),
			activeBound: activeBound === null ? null : toSnapshotBound(activeBound),
			visibleCellCount: getTableEngineVisibleSelectedCellCount(table, viewport),
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

interface TableEngineCellSelectionControllerProps<TData extends RowData> {
	readonly grid: TableEngineTypedGrid<TData>;
	readonly keyboard: boolean;
	readonly clipboard: boolean;
	readonly registerApi: (api: TableEngineCellSelectionApi | null) => void;
}

function TableEngineCellSelectionController<TData extends RowData>({
	grid,
	keyboard,
	clipboard,
	registerApi,
}: TableEngineCellSelectionControllerProps<TData>): React.JSX.Element {
	const { props } = useTableEngine();
	const enabled = props.tableLayout.cellSelection;
	const [viewportEl, setViewportEl] = React.useState<HTMLElement | null>(null);
	const [editorSession, setEditorSession] = React.useState<TableEngineEditorSession | null>(null);

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
			setViewportEl(anchor === null || !enabled ? null : findTableEngineBodyViewport(anchor));
		},
		[enabled],
	);

	const { atoms } = grid.table;
	React.useEffect((): (() => void) | undefined => {
		if (!enabled || viewportEl === null) {
			return undefined;
		}
		return attachTableEngineCellSelection({
			viewport: viewportEl,
			keyboard,
			clipboard,
			getGrid: (): TableEngineTypedGrid<TData> => gridRef.current,
			getProps: (): TableEngineLayoutProps => propsRef.current,
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

	// The frame that hands focus back to the grid after an editor closes. Kept so a grid that leaves the page before
	// the frame runs drops it, instead of focusing and scrolling elements that are no longer in the document.
	const refocusFrame = React.useRef<number | null>(null);
	React.useEffect(
		() => (): void => {
			if (refocusFrame.current !== null) {
				cancelAnimationFrame(refocusFrame.current);
			}
		},
		[],
	);

	// Closing an editor finished with keys hands focus back to the grid (after
	// an optional advance); a blur-initiated close must NOT steal focus back.
	const closeEditorSession = React.useCallback(
		(advance: TableEngineEditorAdvance, refocus: boolean): void => {
			setEditorSession(null);
			if (viewportEl === null) {
				return;
			}
			const { table } = gridRef.current;
			const focused = table.getFocusedCell();
			if (advance !== null && focused !== undefined) {
				const target = getTableEngineStepTarget(table, viewportEl, { rowId: focused.row.id, columnId: focused.column.id }, advance);
				if (target === null) {
					table.moveCellSelection(advance);
				} else if (target !== "edge") {
					table.setFocusedCell(target.rowId, target.columnId);
				}
			}
			if (!refocus) {
				return;
			}
			if (refocusFrame.current !== null) {
				cancelAnimationFrame(refocusFrame.current);
			}
			refocusFrame.current = requestAnimationFrame((): void => {
				refocusFrame.current = null;
				const focusElement = viewportEl.querySelector<HTMLElement>(GRID_TABLE_SELECTOR) ?? viewportEl;
				focusElement.focus();
				const cell = viewportEl.querySelector<HTMLElement>(FOCUSED_CELL_SELECTOR);
				if (cell !== null && cell.id !== "") {
					focusElement.setAttribute("aria-activedescendant", cell.id);
				}
				scrollTableEngineCellIntoView(cell);
			});
		},
		[viewportEl],
	);

	const commitEditorSession = React.useCallback(
		(raw: string, advance: TableEngineEditorAdvance, refocus: boolean): void => {
			const session = editorSession;
			closeEditorSession(advance, refocus);
			const { onCellsChange, table } = gridRef.current;
			if (session === null || onCellsChange === undefined) {
				return;
			}
			const details = buildTableEngineEditDetails(table, session, raw);
			if (details !== null) {
				onCellsChange(details);
			}
		},
		[editorSession, closeEditorSession],
	);

	const cancelEditorSession = React.useCallback((): void => {
		closeEditorSession(null, true);
	}, [closeEditorSession]);

	const validateEditorSession = React.useCallback(
		(raw: string): string | null => (editorSession === null ? null : validateTableEngineEdit(gridRef.current.table, editorSession, raw)),
		[editorSession],
	);

	return (
		<>
			<span ref={handleAnchorRef} hidden data-slot="cell-selection" />
			{enabled && viewportEl !== null && editorSession !== null ? (
				<TableEngineCellEditorOverlay
					key={`${editorSession.rowId}:${editorSession.columnId}`}
					viewport={viewportEl}
					session={editorSession}
					enterAdvance={props.tableLayout.cellEditEnterAdvance}
					onCommit={commitEditorSession}
					onCancel={cancelEditorSession}
					validate={validateEditorSession}
				/>
			) : null}
		</>
	);
}

export interface TableEngineCellSelectionProps {
	/** Receives the controller's imperative API (also exposed through `ref`), e.g. for create-row flows. */
	readonly apiRef?: React.Ref<TableEngineCellSelectionApi>;
	/** Native copy, cut and paste handling. Defaults to `true`. */
	readonly clipboard?: boolean;
	/** Arrows (Ctrl/Cmd edge jumps), Home/End, PageUp/PageDown, Enter, F2, type-to-edit, Tab, Ctrl/Cmd+A, Delete, Escape. Defaults to `true`. */
	readonly keyboard?: boolean;
}

/**
 * Headless spreadsheet controller: keyboard navigation, clipboard, clear,
 * editing and the fill-handle drag. Mount once inside `<TableEngine>` (in the
 * same `TableEngineContainer` as the table) with `tableLayout.cellSelection` on.
 * Renders only a hidden anchor; its `ref` is the imperative
 * `TableEngineCellSelectionApi`.
 */
export const TableEngineCellSelection = React.forwardRef<TableEngineCellSelectionApi, TableEngineCellSelectionProps>(function TableEngineCellSelection(
	{ apiRef, clipboard = true, keyboard = true },
	ref,
): React.JSX.Element {
	const { withGrid } = useTableEngine();
	const implementationRef = React.useRef<TableEngineCellSelectionApi | null>(null);
	const registerApi = React.useCallback((api: TableEngineCellSelectionApi | null): void => {
		implementationRef.current = api;
	}, []);
	// Stable proxies: the listeners (and their API) attach after mount, and
	// re-attach when the viewport changes; callers keep one handle throughout.
	const createHandle = React.useCallback(
		(): TableEngineCellSelectionApi => ({
			focusCell: (rowId: string, columnId: string, options?: TableEngineFocusCellOptions): void => {
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
		(): TableEngineGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <TableEngineCellSelectionController grid={grid} keyboard={keyboard} clipboard={clipboard} registerApi={registerApi} />,
		}),
		[keyboard, clipboard, registerApi],
	);
	return withGrid(visitor);
});

// ── TableEngineSelectionBar ───────────────────────────────────────────────────
