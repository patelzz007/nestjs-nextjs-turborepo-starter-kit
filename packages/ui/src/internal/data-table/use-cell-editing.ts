"use client";

// DataTable's side of in-place editing: it hands each committed edit to `editing.onCellEdit`, follows a save that
// returns a promise (the cell is marked while it saves; a rejection writes the old value back and marks the cell),
// and keeps the undo history. It never changes a row itself: every write, undo and revert goes through `onCellEdit`.

import type { CellData, RowData } from "@tanstack/react-table";
import {
	createDataTableEditHistory,
	formatDataTableLabel,
	pushDataTableEdit,
	redoDataTableEdit,
	undoDataTableEdit,
	type DataTableEditHistory,
	type DataTableEditStep,
	type DataTableLabels,
} from "@workspace/ui-kit-logic";
import * as React from "react";

import type { TableEngineCellStatus, TableEngineCellsChangeDetails } from "../table-engine/table-engine";
import type { DataTableCellEdit, DataTableCellEditSource, DataTableEditing, DataTableRowIdReader } from "./props";

/** Where one cell's save stands. A cell with no entry is as saved. */
type CellSaveState = "saving" | "failed";

function cellKey(rowId: string, columnId: string): string {
	return `${rowId}\u0000${columnId}`;
}

/** The mark the engine draws for a cell's save state: a saving cell as unsaved, a failed one as invalid. */
export function cellStatusForSaveState(state: CellSaveState | undefined): TableEngineCellStatus | undefined {
	if (state === undefined) {
		return undefined;
	}
	return state === "saving" ? "dirty" : "invalid";
}

export interface CellEditingController<TData extends RowData> {
	/** The engine's batch handler: committed edits only (a records table never pastes, cuts, clears or fills). */
	readonly handleCellsChange: (details: TableEngineCellsChangeDetails<TData>) => void;
	/** The engine's per-cell mark, or `undefined` when nothing is saving or failed. */
	readonly getCellStatus: ((row: TData, columnId: string) => TableEngineCellStatus | undefined) | undefined;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly undo: () => void;
	readonly redo: () => void;
	/** The last failed save, said out loud; empty when there is none. */
	readonly announcement: string;
}

export interface UseCellEditingOptions<TData extends RowData> {
	readonly editing: DataTableEditing<TData> | undefined;
	readonly data: readonly TData[];
	readonly getRowId: DataTableRowIdReader<TData>;
	/** A column's title, for the failed-save announcement. */
	readonly columnTitle: (columnId: string) => string;
	readonly labels: DataTableLabels;
}

export function useCellEditing<TData extends RowData>({ editing, data, getRowId, columnTitle, labels }: UseCellEditingOptions<TData>): CellEditingController<TData> {
	const onCellEdit = editing?.onCellEdit;
	const [saveStates, setSaveStates] = React.useState<Readonly<Record<string, CellSaveState>>>({});
	const [history, setHistory] = React.useState<DataTableEditHistory<CellData>>(createDataTableEditHistory);
	const [announcement, setAnnouncement] = React.useState("");

	const setSaveState = React.useCallback((key: string, state: CellSaveState | null): void => {
		setSaveStates((current) => {
			const others = Object.fromEntries(Object.entries(current).filter(([entryKey]) => entryKey !== key));
			return state === null ? others : { ...others, [key]: state };
		});
	}, []);

	/**
	 * Writes one cell through `onCellEdit`. A promise marks the cell until it settles; a rejection writes the old value
	 * back (`revert`) and runs `onFailed`. `onSaved` runs once the write stands: at once, or when the promise resolves.
	 */
	const write = React.useCallback(
		(edit: DataTableCellEdit<TData>, onSaved: () => void, onFailed: () => void): void => {
			if (onCellEdit === undefined) {
				return;
			}
			const key = cellKey(edit.rowId, edit.columnId);
			const result = onCellEdit(edit);
			if (!(result instanceof Promise)) {
				setSaveState(key, null);
				onSaved();
				return;
			}
			setSaveState(key, "saving");
			result.then(
				(): void => {
					setSaveState(key, null);
					onSaved();
				},
				(): void => {
					setSaveState(key, "failed");
					setAnnouncement(formatDataTableLabel(labels.cellEditFailed, { column: columnTitle(edit.columnId) }));
					void onCellEdit({ ...edit, value: edit.previousValue, previousValue: edit.value, source: "revert" });
					onFailed();
				},
			);
		},
		[onCellEdit, setSaveState, labels.cellEditFailed, columnTitle],
	);

	const noop = React.useCallback((): void => {
		// A write with nothing to do afterwards.
	}, []);

	const handleCellsChange = React.useCallback(
		(details: TableEngineCellsChangeDetails<TData>): void => {
			if (details.source !== "edit") {
				return;
			}
			for (const change of details.changes) {
				const step: DataTableEditStep<CellData> = { rowId: change.rowId, columnId: change.columnId, previousValue: change.previousValue, value: change.value };
				write(
					{ ...step, row: change.row, source: "edit" },
					(): void => {
						setHistory((current) => pushDataTableEdit(current, step));
					},
					noop,
				);
			}
		},
		[write, noop],
	);

	/** Writes one history step back for `source`, or drops it when its row is gone. A failed write keeps the history as it was. */
	const stepThrough = React.useCallback(
		(source: Extract<DataTableCellEditSource, "undo" | "redo">): void => {
			const move = source === "undo" ? undoDataTableEdit(history) : redoDataTableEdit(history);
			if (move === null) {
				return;
			}
			const before = history;
			setHistory(move.history);
			const row = data.find((candidate) => getRowId(candidate) === move.step.rowId);
			if (row === undefined) {
				return;
			}
			write({ ...move.step, row, source }, noop, (): void => {
				setHistory(before);
			});
		},
		[history, data, getRowId, write, noop],
	);

	const undo = React.useCallback((): void => {
		stepThrough("undo");
	}, [stepThrough]);
	const redo = React.useCallback((): void => {
		stepThrough("redo");
	}, [stepThrough]);

	const hasSaveStates = Object.keys(saveStates).length > 0;
	const getCellStatus = React.useCallback(
		(row: TData, columnId: string): TableEngineCellStatus | undefined => cellStatusForSaveState(saveStates[cellKey(getRowId(row), columnId)]),
		[saveStates, getRowId],
	);

	return {
		handleCellsChange,
		getCellStatus: hasSaveStates ? getCellStatus : undefined,
		canUndo: history.past.length > 0,
		canRedo: history.future.length > 0,
		undo,
		redo,
		announcement,
	};
}
