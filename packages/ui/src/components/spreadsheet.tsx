"use client";

// ============================================================
// components/spreadsheet.tsx
//
// A grid of cells: select ranges with the mouse or the keyboard, copy, cut and paste, drag the fill handle, and edit
// in place. It is deliberately dumb: the smart component owns the rows and applies every write it is told about
// (`onCellsChange`); the grid itself never changes data.
//
// For a list of records with a toolbar, filters, a pager and row actions, use `DataTable` instead. Both are built on
// the same private engine (internal/table-engine), so sorting, resizing and virtual scrolling behave the same.
// ============================================================

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { useTable, type ColumnSizingState, type RowData, type SortingState, type TableOptions } from "@tanstack/react-table";
import * as React from "react";

import { TableEngineCellSelection } from "../internal/spreadsheet/cell-selection";
import {
	createSpreadsheetGrid,
	SpreadsheetFormulaBar,
	SpreadsheetGridProvider,
	toSpreadsheetCellInput,
	withSpreadsheetA1Headers,
	withSpreadsheetFormulas,
	type SpreadsheetGrid,
} from "../internal/spreadsheet/formulas";
import type { SpreadsheetCellStatus, SpreadsheetColumns, SpreadsheetProps, SpreadsheetRowStatus, SpreadsheetSelection } from "../internal/spreadsheet/props";
import { TableEngine, TableEngineContainer, tableEngineFeatures, type TableEngineFeatures, type TableEngineTableLayout } from "../internal/table-engine/table-engine";
import { TableEngineScrollArea } from "../internal/table-engine/table-engine-scroll-area";
import { TableEngineTable } from "../internal/table-engine/table-engine-table";
import { TableEngineTableVirtual } from "../internal/table-engine/table-engine-table-virtual";
import { prepareColumn, type FilteredColumns } from "../internal/data-table/use-table-state";

export type {
	SpreadsheetApi,
	SpreadsheetCellEditRequest,
	SpreadsheetCellStatus,
	SpreadsheetCellsChange,
	SpreadsheetColumns,
	SpreadsheetCopy,
	SpreadsheetDraftRow,
	SpreadsheetEditing,
	SpreadsheetFeatures,
	SpreadsheetFillHandle,
	SpreadsheetLayout,
	SpreadsheetProps,
	SpreadsheetRowStatus,
	SpreadsheetSelection,
	SpreadsheetVirtualize,
} from "../internal/spreadsheet/props";
export type { TableEngineColumnMeta as SpreadsheetColumnMeta } from "../internal/table-engine/table-engine";

/** No column sits behind a toolbar filter in a spreadsheet. */
const NO_FILTERED_COLUMNS: FilteredColumns = new Map();

/** A grid of cells with range selection, clipboard, fill and in-place editing, each switched on by a prop. */
export function Spreadsheet<TData extends RowData>({
	ref,
	data,
	columns: callerColumns,
	getRowId,
	onCellsChange,
	onCellEditRequest,
	selectionMode = "range",
	onSelectionChange,
	onCopy,
	fillHandle,
	editing,
	rowStatus,
	cellStatus,
	draftRow,
	formulas = false,
	headers = "columns",
	layout,
	virtualize,
	labels,
	className,
}: SpreadsheetProps<TData>): React.JSX.Element {
	const isA1 = headers === "a1";
	const engineLabels = useUiKitLabels("tableEngine", labels);
	// Every writable column gets the built-in text editor unless it chose its own control; formulas and A1 headers
	// wrap the columns on top of that.
	const columns = React.useMemo((): SpreadsheetColumns<TData> => {
		const prepared = callerColumns.map((column) => prepareColumn(column, NO_FILTERED_COLUMNS, true));
		const withFormulas = formulas ? withSpreadsheetFormulas(prepared) : prepared;
		return isA1 ? withSpreadsheetA1Headers(withFormulas) : withFormulas;
	}, [callerColumns, formulas, isA1]);

	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

	const tableOptions = React.useMemo(
		(): TableOptions<TableEngineFeatures, TData> => ({
			features: tableEngineFeatures,
			data,
			columns,
			getRowId: (row: TData): string => getRowId(row),
			// A spreadsheet shows every row: there is no pager.
			state: { sorting, columnSizing, pagination: { pageIndex: 0, pageSize: Math.max(data.length, 1) } },
			onSortingChange: setSorting,
			onColumnSizingChange: setColumnSizing,
			enableColumnResizing: true,
		}),
		[data, columns, getRowId, sorting, columnSizing],
	);
	const table = useTable(tableOptions);

	const hasFillHandle = fillHandle !== undefined;
	const fillHandleVariant = fillHandle?.variant ?? "dot";
	const editTrigger = editing?.trigger ?? "double-click";
	const enterAdvances = editing?.enterAdvances ?? true;
	const density = layout?.density;
	const cellBorders = layout?.cellBorders ?? true;
	const stickyHeader = layout?.stickyHeader === true;

	const engineLayout = React.useMemo(
		(): TableEngineTableLayout => ({
			dense: density === "compact",
			spacious: density === "spacious",
			cellBorder: cellBorders,
			headerSticky: stickyHeader,
			headerBackground: true,
			columnsResizable: true,
			cellSelection: true,
			cellSelectionMode: selectionMode,
			cellFillHandle: hasFillHandle,
			cellFillHandleVariant: fillHandleVariant,
			cellEditMode: editTrigger === "click" ? "click" : "dblclick",
			cellEditEnterAdvance: enterAdvances,
		}),
		[density, cellBorders, stickyHeader, selectionMode, hasFillHandle, fillHandleVariant, editTrigger, enterAdvances],
	);

	const handleRowStatus = React.useCallback((row: TData): SpreadsheetRowStatus | undefined => rowStatus?.(row), [rowStatus]);
	const handleCellStatus = React.useCallback((row: TData, columnId: string): SpreadsheetCellStatus | undefined => cellStatus?.(row, columnId), [cellStatus]);

	// The A1 grid of this state of the table: formula results and cell addresses. Rebuilt when the rows, the order or
	// the columns change (the table wrapper is new then); each formula is worked out lazily, once.
	const grid = React.useMemo((): SpreadsheetGrid => createSpreadsheetGrid(table), [table]);

	// The focused cell, for the A1 bar: its address and what it holds (the formula, not its result).
	const [focusedCell, setFocusedCell] = React.useState<{ readonly rowId: string; readonly columnId: string } | null>(null);
	const handleSelectionChange = React.useCallback(
		(selection: SpreadsheetSelection): void => {
			setFocusedCell(selection.focused);
			onSelectionChange?.(selection);
		},
		[onSelectionChange],
	);
	const focusedAddress = focusedCell === null ? null : grid.addressOf(focusedCell.rowId, focusedCell.columnId);
	const focusedContent = focusedCell === null ? null : toSpreadsheetCellInput(table.getRow(focusedCell.rowId, true).getValue(focusedCell.columnId));

	const maxHeight = layout?.maxHeight;
	const scrollAreaStyle = React.useMemo((): React.CSSProperties | undefined => (maxHeight === undefined ? undefined : { maxHeight }), [maxHeight]);
	const isVirtual = virtualize?.rows === true || virtualize?.columns === true;

	return (
		<TableEngine
			table={table}
			recordCount={data.length}
			tableLayout={engineLayout}
			labels={labels}
			onCellsChange={onCellsChange}
			onCellEditRequest={onCellEditRequest}
			onCellSelectionChange={isA1 ? handleSelectionChange : onSelectionChange}
			onCellsCopy={onCopy}
			onRowCreate={draftRow?.onCreate}
			rowCreateLabel={draftRow?.label}
			getRowStatus={rowStatus === undefined ? undefined : handleRowStatus}
			getCellStatus={cellStatus === undefined ? undefined : handleCellStatus}>
			<TableEngineContainer variant="bordered" data-slot="spreadsheet" className={cn("w-full", className)}>
				{isA1 ? <SpreadsheetFormulaBar address={focusedAddress ?? ""} content={String(focusedContent ?? "")} label={engineLabels.cellAddress} /> : null}
				<SpreadsheetGridProvider value={grid}>
					<TableEngineScrollArea style={scrollAreaStyle}>
						{isVirtual ? <TableEngineTableVirtual columnVirtualizerOptions={{ enabled: virtualize.columns === true }} /> : <TableEngineTable />}
					</TableEngineScrollArea>
				</SpreadsheetGridProvider>
				<TableEngineCellSelection ref={ref} />
			</TableEngineContainer>
		</TableEngine>
	);
}
