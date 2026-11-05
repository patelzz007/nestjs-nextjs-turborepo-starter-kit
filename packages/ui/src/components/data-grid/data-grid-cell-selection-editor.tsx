"use client";

// The cell selection's inline editor (enhancement 8.1: split from data-grid-cell-selection.tsx): its overlay, measured to sit exactly over the cell.

import { LIST_SLOT_INDEX, hasGlobalConstructor } from "@workspace/shared";
import { type DataGridCellsChangeDetails, type DataGridCoreTable } from "@workspace/ui/components/data-grid/data-grid";
import type { RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import * as React from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { getDataGridWritableCellEdit } from "./data-grid-cell-selection-clipboard";
import {
	DATA_GRID_GESTURE_Z_INDEX,
	DEFAULT_LINE_HEIGHT_PX,
	type DataGridEditorAdvance,
	type DataGridEditorSession,
	FOCUSED_CELL_SELECTOR,
	HALF,
	LINE_HEIGHT_FONT_RATIO,
} from "./data-grid-cell-selection-model";

/** The body viewport of the grid that contains `anchor`: in split header/body grids, the one holding the body. */
export function findDataGridBodyViewport(anchor: HTMLElement): HTMLElement | null {
	const root = anchor.closest('[data-slot="data-grid"]') ?? anchor.parentElement;
	if (root === null) {
		return null;
	}
	const viewports = [...root.querySelectorAll<HTMLElement>('[data-slot="data-grid-table-viewport"]')];
	return viewports.find((node) => node.querySelector('[data-slot="data-grid-table-body"]') !== null) ?? viewports.at(LIST_SLOT_INDEX.first) ?? null;
}

// ── Built-in editor overlay ────────────────────────────────────────────────

export const TextAlignSchema = z.enum(["start", "end", "left", "right", "center", "justify", "match-parent"]);

export function parsePixels(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * The editor box: flush over the focused cell with the cell's own font,
 * alignment and padding, so the text keeps its exact place. Rect deltas are
 * visual; the viewport's scroll offset is added back for a viewport that is
 * itself the scroll container.
 */
export function measureDataGridCellEditorStyle(viewport: HTMLElement): React.CSSProperties | null {
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
export function focusEditorAtEnd(element: HTMLInputElement | HTMLTextAreaElement | null): void {
	if (element === null) {
		return;
	}
	const end = element.value.length;
	element.focus();
	element.setSelectionRange(end, end);
}

export const dataGridCellEditorVariants = cva("absolute box-border resize-none bg-background text-foreground outline-1 -outline-offset-1 outline-primary outline-solid", {
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

export type DataGridEditorElement = HTMLInputElement | HTMLTextAreaElement;

export interface DataGridCellEditorOverlayProps {
	readonly viewport: HTMLElement;
	readonly session: DataGridEditorSession;
	readonly enterAdvance: boolean;
	readonly onCommit: (raw: string, advance: DataGridEditorAdvance, refocus: boolean) => void;
	readonly onCancel: () => void;
}

export function DataGridCellEditorOverlay({ viewport, session, enterAdvance, onCommit, onCancel }: DataGridCellEditorOverlayProps): React.JSX.Element | null {
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
export function buildDataGridEditDetails<TData extends RowData>(
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
