"use client";

// The cell selection's inline editor (enhancement 8.1: split from cell-selection.tsx): its overlay, measured to sit exactly over the cell.

import { LIST_SLOT_INDEX, hasGlobalConstructor } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import { type TableEngineCellsChangeDetails, type TableEngineCoreTable } from "../table-engine/table-engine";
import type { RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import * as React from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { getTableEngineWritableCellEdit } from "./cell-selection-clipboard";
import {
	TABLE_ENGINE_GESTURE_Z_INDEX,
	DEFAULT_LINE_HEIGHT_PX,
	type TableEngineEditorAdvance,
	type TableEngineEditorSession,
	FOCUSED_CELL_SELECTOR,
	HALF,
	LINE_HEIGHT_FONT_RATIO,
} from "./cell-selection-model";

/** The body viewport of the grid that contains `anchor`: in split header/body grids, the one holding the body. */
export function findTableEngineBodyViewport(anchor: HTMLElement): HTMLElement | null {
	const root = anchor.closest('[data-slot="table-engine"]') ?? anchor.parentElement;
	if (root === null) {
		return null;
	}
	const viewports = [...root.querySelectorAll<HTMLElement>('[data-slot="table-engine-table-viewport"]')];
	return viewports.find((node) => node.querySelector('[data-slot="table-engine-table-body"]') !== null) ?? viewports.at(LIST_SLOT_INDEX.first) ?? null;
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
export function measureTableEngineCellEditorStyle(viewport: HTMLElement): React.CSSProperties | null {
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
		zIndex: TABLE_ENGINE_GESTURE_Z_INDEX,
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

export const tableEngineCellEditorVariants = cva("absolute box-border resize-none bg-background text-foreground outline-1 -outline-offset-1 outline-primary outline-solid", {
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

export type TableEngineEditorElement = HTMLInputElement | HTMLTextAreaElement;

export interface TableEngineCellEditorOverlayProps {
	readonly viewport: HTMLElement;
	readonly session: TableEngineEditorSession;
	readonly enterAdvance: boolean;
	readonly onCommit: (raw: string, advance: TableEngineEditorAdvance, refocus: boolean) => void;
	readonly onCancel: () => void;
	/** What is wrong with the text, or `null` when it may be committed. */
	readonly validate: (raw: string) => string | null;
}

export function TableEngineCellEditorOverlay({ viewport, session, enterAdvance, onCommit, onCancel, validate }: TableEngineCellEditorOverlayProps): React.JSX.Element | null {
	// Measured once: the overlay remounts per cell via its key.
	const [style] = React.useState((): React.CSSProperties | null => measureTableEngineCellEditorStyle(viewport));
	const finishedRef = React.useRef(false);
	// The validation message of the last commit attempt; cleared as soon as the text changes.
	const [error, setError] = React.useState<string | null>(null);
	const errorId = React.useId();

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
		(element: TableEngineEditorElement, commit: boolean, advance: TableEngineEditorAdvance, refocus: boolean): void => {
			// One finish per session: an Enter commit can be chased by the unmount's blur.
			if (finishedRef.current) {
				return;
			}
			// A value the column refuses is not committed. With keys (refocus) the editor stays open with the message;
			// leaving the cell (blur) drops the edit, so an invalid value is never left behind half-typed.
			const message = commit ? validate(element.value) : null;
			if (message !== null && refocus) {
				setError(message);
				return;
			}
			finishedRef.current = true;
			if (commit && message === null) {
				onCommit(element.value, advance, refocus);
			} else {
				onCancel();
			}
		},
		[onCommit, onCancel, validate],
	);

	const handleChange = React.useCallback((): void => {
		setError(null);
	}, []);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<TableEngineEditorElement>): void => {
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
		(event: React.FocusEvent<TableEngineEditorElement>): void => {
			finish(event.currentTarget, true, null, false);
		},
		[finish],
	);

	if (style === null) {
		return null;
	}
	const className = cn(tableEngineCellEditorVariants({ control: session.control }), error === null ? undefined : "outline-destructive");
	const invalidProps = error === null ? {} : { "aria-invalid": true, "aria-errormessage": errorId };
	// The message sits right under the editor: same left edge and width, pushed down by the editor's height.
	const errorStyle: React.CSSProperties = { left: style.left, top: style.top, width: style.width, marginTop: style.height };

	return createPortal(
		<>
			{session.control === "textarea" ? (
				<textarea
					data-slot="table-engine-cell-editor"
					ref={focusEditorAtEnd}
					aria-label={session.label}
					defaultValue={session.initialValue}
					rows={1}
					style={style}
					className={className}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					onChange={handleChange}
					{...invalidProps}
				/>
			) : (
				<input
					data-slot="table-engine-cell-editor"
					ref={focusEditorAtEnd}
					aria-label={session.label}
					defaultValue={session.initialValue}
					style={style}
					className={className}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					onChange={handleChange}
					{...invalidProps}
				/>
			)}
			{error === null ? null : (
				<div
					id={errorId}
					role="alert"
					data-slot="table-engine-cell-editor-error"
					style={errorStyle}
					className="absolute z-50 min-w-40 rounded-md border border-destructive/30 bg-popover px-2 py-1 text-xs text-destructive-foreground shadow-md">
					{error}
				</div>
			)}
		</>,
		viewport,
	);
}

// ── TableEngineCellSelection ──────────────────────────────────────────────────

/**
 * What is wrong with the editor's text, or `null` when it may be committed: the column's `validate` message for the
 * parsed value. Text that does not parse is left to the commit, which reports it as rejected, as before.
 */
export function validateTableEngineEdit<TData extends RowData>(table: TableEngineCoreTable<TData>, session: TableEngineEditorSession, raw: string): string | null {
	if (raw === session.baseline) {
		return null;
	}
	const row = table.getRowsInDisplayOrder().find((candidate) => candidate.id === session.rowId);
	const column = table.getAllLeafColumns().find((candidate) => candidate.id === session.columnId);
	const cellEdit = row === undefined || column === undefined ? null : getTableEngineWritableCellEdit(column, row.original);
	const validate = cellEdit?.validate;
	if (row === undefined || cellEdit === null || validate === undefined) {
		return null;
	}
	const value = cellEdit.parse === undefined ? raw : cellEdit.parse(raw, row.original);
	return value === undefined ? null : (validate(value, row.original) ?? null);
}

/** The editor commit as a batch: nothing for an unchanged value, a rejection for a failed parse. */
export function buildTableEngineEditDetails<TData extends RowData>(
	table: TableEngineCoreTable<TData>,
	session: TableEngineEditorSession,
	raw: string,
): TableEngineCellsChangeDetails<TData> | null {
	if (raw === session.baseline) {
		return null;
	}
	const row = table.getRowsInDisplayOrder().find((candidate) => candidate.id === session.rowId);
	const column = table.getAllLeafColumns().find((candidate) => candidate.id === session.columnId);
	const cellEdit = row === undefined || column === undefined ? null : getTableEngineWritableCellEdit(column, row.original);
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
