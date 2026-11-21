"use client";

// Helpers the DataTable shell's parts share.

import type { RowData } from "@tanstack/react-table";
import * as React from "react";

import type { TableEngineTableInstance } from "../table-engine/table-engine";

/** The table every shell part works with. */
export type DataTableInstance<TData extends RowData> = TableEngineTableInstance<TData>;

// ── Generic-preserving memo ────────────────────────────────────────────────
// `React.memo` collapses a generic component signature to its constraint (`RowData`), which breaks TanStack v9's
// invariant generics at every call site. This wrapper keeps the exact signature while still memoizing.
export function memoGeneric<P extends object>(Component: (props: P) => React.JSX.Element): (props: P) => React.JSX.Element {
	const Inner = React.memo(Component);
	return function MemoWrapper(props: P): React.JSX.Element {
		return <Inner {...props} />;
	};
}

/** Resolves a TanStack state updater (a value, or a function of the previous value). */
export function applyTableUpdater<T>(updater: T | ((previous: T) => T), previous: T): T {
	if (updater instanceof Function) {
		return updater(previous);
	}
	return updater;
}

/** An outline button that removes something, or reports that something failed: the table's one destructive look. */
export const DESTRUCTIVE_OUTLINE_CLASS_NAME = "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive";

/** The neutral surface of the selection bars: it sits well beside outline and destructive buttons. */
export const SELECTION_SURFACE_CLASS_NAME = "mb-4 rounded-lg border border-border bg-muted/50 p-3 sm:p-4";

/** The toolbar buttons that open a menu (export, columns). */
export const TOOLBAR_MENU_TRIGGER_CLASS_NAME =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground";

/** A select filter's "no filter" choice. Never a real option value. */
export const FILTER_ALL_VALUE = "all";
