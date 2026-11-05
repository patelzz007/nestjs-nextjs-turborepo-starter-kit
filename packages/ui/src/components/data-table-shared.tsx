"use client";

// Helpers DataTable's parts share (enhancement 8.1: split from data-table.tsx).

import { type Cell, type Column, type RowData, type RowSelectionState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";
import { DataTableCellValueSchema, toDataTableCellString } from "@workspace/ui/lib/data-table/prefs";
import { z } from "zod";
import { type DataTableFeatures } from "./data-table-types";

// ── Generic-preserving memo ────────────────────────────────────────────────
// React's built-in `React.memo` collapses a generic component signature
// (`<TData extends RowData>(props: P<TData>) => JSX`) down to its constraint
// (`RowData`), which then breaks TanStack v9's invariant generics at every
// call site. This wrapper keeps the exact signature while still memoizing.
export function memoGeneric<P extends object>(Component: (props: P) => React.JSX.Element): (props: P) => React.JSX.Element {
	const Inner = React.memo(Component);
	return function MemoWrapper(props: P): React.JSX.Element {
		return <Inner {...props} />;
	};
}

export function applyTableUpdater<T>(updater: T | ((previous: T) => T), previous: T): T {
	if (updater instanceof Function) return updater(previous);

	return updater;
}

export const columnHeaderLabelSchema = z.string();

// ── The v9 feature set (module scope — built once, shared by every instance) ─

/** Coerce a TanStack cell into a display string via Zod at the library boundary. */
export function cellValueDisplayString<TData extends RowData>(cell: Cell<DataTableFeatures, TData>): string {
	const parsed = DataTableCellValueSchema.safeParse(cell.getValue());
	return parsed.success ? toDataTableCellString(parsed.data) : "";
}

export function getSortIcon<TData extends RowData>(column: Column<DataTableFeatures, TData>): React.JSX.Element {
	const sorted = column.getIsSorted();
	if (sorted === "asc") return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
	if (sorted === "desc") return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
	return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
}

// ── Inline Edit Input ──────────────────────────────────────────────────────

export const PIN_SHADOW_START = "2px 0 4px rgba(0,0,0,0.08)";
export const PIN_SHADOW_END = "-2px 0 4px rgba(0,0,0,0.08)";

export const EMPTY_PINNED_STYLES: React.CSSProperties = {};
export function buildPinnedColumnStyles(isPinned: false | "start" | "end", start: number, after: number, zIndex: number): React.CSSProperties {
	if (!isPinned) {
		return EMPTY_PINNED_STYLES;
	}
	return {
		position: "sticky",
		left: isPinned === "start" ? `${String(start)}px` : undefined,
		right: isPinned === "end" ? `${String(after)}px` : undefined,
		zIndex,
		backgroundColor: "var(--color-card)",
		boxShadow: isPinned === "start" ? PIN_SHADOW_START : PIN_SHADOW_END,
	};
}

/** Selector factory: `true` when the row with `rowId` is in the selection set. */
export const rowSelectionSelector =
	(rowId: string): ((selection: RowSelectionState) => boolean) =>
	(selection: RowSelectionState): boolean =>
		selection[rowId] === true;

export const bulkSelectionSurfaceClasses = "mb-4 rounded-lg border border-border bg-muted/50 p-3 sm:p-4";

// ── Bulk Action Button (sub-component: the per-action closure lives here) ───
