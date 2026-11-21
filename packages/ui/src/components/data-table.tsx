"use client";

// ============================================================
// components/data-table.tsx
//
// The records table: one component for every list of records in an app. It is deliberately dumb: the smart component
// owns the rows, the column definitions, the labels and every callback; nothing is fetched or hardcoded here.
//
// Read the props (internal/data-table/props.ts) top to bottom to see what it can do: one prop per job, and a job is
// off while its prop is absent.
//
// How it is built:
//   - this file            the card, the toolbar, the states and the pager around the table;
//   - internal/data-table  the parts of that shell, and the hook that owns the table's state;
//   - internal/table-engine   the private rendering engine (rows, cells, headers, pinning, resizing, drag, virtual
//                             scrolling), shared with `Spreadsheet`. Apps cannot import it.
// ============================================================

import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { useElementWidth } from "@workspace/ui/hooks/use-element-width";
import { DESKTOP_MEDIA_QUERY } from "@workspace/ui/hooks/use-mobile";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveDataTableRowMove, type DataTableDensity } from "@workspace/ui-kit-logic";
import type { RowData } from "@tanstack/react-table";
import type { DragEndEvent } from "@dnd-kit/core";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, Columns3, Redo2, Undo2 } from "lucide-react";
import * as React from "react";

import { SelectionIsland } from "../internal/data-table/bulk-bar";
import { ExportMenu } from "../internal/data-table/export-menu";
import { MobileCardView } from "../internal/data-table/mobile-card-view";
import { Pager } from "../internal/data-table/pager";
import type { DataTableLayout, DataTableProps, DataTableRowAction, DataTableRowStatus } from "../internal/data-table/props";
import { TOOLBAR_MENU_TRIGGER_CLASS_NAME } from "../internal/data-table/shared";
import { EmptyState, ErrorState, NoResults } from "../internal/data-table/states";
import { DensityMenu } from "../internal/data-table/density-menu";
import { DetailPanel } from "../internal/data-table/detail-panel";
import { ExportDialog } from "../internal/data-table/export-dialog";
import { Toolbar, type ToolbarResultCount } from "../internal/data-table/toolbar";
import { useDataTableState } from "../internal/data-table/use-table-state";
import { getColumnHeaderLabel, TableEngine, TableEngineContainer, type TableEngineTableLayout } from "../internal/table-engine/table-engine";
import { isTableEngineEditableTarget } from "../internal/spreadsheet/cell-selection-model";
import { useCellEditing } from "../internal/data-table/use-cell-editing";
import { TableEngineColumnVisibility } from "../internal/table-engine/table-engine-column-visibility";
import { TableEngineScrollArea } from "../internal/table-engine/table-engine-scroll-area";
import { TableEngineTable, TableEngineTableFootRow, TableEngineTableFootRowCell } from "../internal/table-engine/table-engine-table";
import { TableEngineTableDndRows } from "../internal/table-engine/table-engine-table-dnd-rows";
import { TableEngineTableVirtual } from "../internal/table-engine/table-engine-table-virtual";

export type {
	DataTableActionTone,
	DataTableBulkAction,
	DataTableBulkActionHandler,
	DataTableBulkSelectionContext,
	DataTableCellEdit,
	DataTableCellEditSource,
	DataTableClientSource,
	DataTableColumnControls,
	DataTableColumns,
	DataTableDateRangeFilter,
	DataTableDetail,
	DataTableRowTitleReader,
	DataTableDraftRows,
	DataTableGrouping,
	DataTableEditing,
	DataTableEmptyState,
	DataTableExporting,
	DataTableFeatures,
	DataTableFilter,
	DataTableFilterOption,
	DataTableFooter,
	DataTableFooterRow,
	DataTableHeading,
	DataTableInfiniteSource,
	DataTableLabelsOverride,
	DataTableLayout,
	DataTableLoading,
	DataTableMobileCardRenderer,
	DataTableMultiSelectFilter,
	DataTablePaging,
	DataTablePreferences,
	DataTableProps,
	DataTableRowAction,
	DataTableRowPredicate,
	DataTableRowReorder,
	DataTableRowKey,
	DataTableRowStatus,
	DataTableSearch,
	DataTableSelectFilter,
	DataTableSelection,
	DataTableSelectionScope,
	DataTableServerSource,
	DataTableSortCycle,
	DataTableSortingOptions,
	DataTableSource,
	DataTableStatus,
	DataTableToolbar,
	DataTableToolbarLayout,
	DataTableTree,
	DataTableVirtualize,
} from "../internal/data-table/props";
export type { TableEngineColumnMeta as DataTableColumnMeta } from "../internal/table-engine/table-engine";
export type {
	DataTableDateRange,
	DataTableDateZone,
	DataTableDensity,
	DataTableExportFormat,
	DataTableFilterValue,
	DataTableFilterValues,
	DataTableLabels,
	DataTableQuery,
	DataTableQueryChange,
	DataTableRowMove,
	DataTableStorageAdapter,
} from "@workspace/ui-kit-logic";
export { DATA_TABLE_EXPORT_FORMATS, createDataTableQuery, isDataTableQueryFiltered, pivotDataTableRows } from "@workspace/ui-kit-logic";
export type { DataTablePivot, DataTablePivotAggregation, DataTablePivotSpec, DataTableRowActionTone } from "@workspace/ui-kit-logic";
export { createLocalStorageDataTableStorage } from "@workspace/ui/lib/table/storage";

/** How many skeleton rows an initial load draws when `status.skeletonRows` names none. */
const DEFAULT_SKELETON_ROWS = 5;

const NO_ROW_ACTIONS: readonly DataTableRowAction<RowData>[] = [];

/**
 * Below this width, in pixels, a table with `mobileCard` shows cards. The `sm` breakpoint: narrower than that, a row
 * of columns no longer fits, whether the window is a phone or the table sits in a narrow panel.
 */
const CARD_LAYOUT_MAX_WIDTH_PX = 640;

/** The engine's layout flags for a table's `layout`, `sorting`, column controls and row features. */
function toEngineLayout(
	layout: DataTableLayout | undefined,
	options: {
		/** The density in force: the reader's choice when the control is on, otherwise the caller's. */
		readonly density: DataTableDensity;
		/** The page is being printed. */
		readonly printing: boolean;
		readonly sortCycle: "asc-desc" | "asc-desc-none";
		readonly visibility: boolean;
		readonly pinning: boolean;
		readonly resizing: boolean;
		readonly reordering: boolean;
		readonly rowReorder: boolean;
		readonly rowPinning: boolean;
		/** What opens a cell's editor with a pointer, or `undefined` for a table that does not edit. */
		readonly editTrigger: "double-click" | "click" | undefined;
	},
): TableEngineTableLayout {
	return {
		// The records look is this table's own: the tinted header band with small uppercase titles, and tall rows.
		look: "records",
		dense: options.density === "compact",
		spacious: options.density === "spacious",
		stripped: layout?.striped === true,
		// Paper has no hover and no zebra to follow a row by, so a printed table always draws its cell lines.
		cellBorder: layout?.cellBorders === true || options.printing,
		headerSticky: layout?.stickyHeader === true,
		// The records look tints its own header band; the engine's solid header fill would cover that tint.
		headerBackground: false,
		// Resizable columns need declared widths; otherwise columns size to their content unless the caller says "fixed".
		width: options.resizing ? "fixed" : (layout?.width ?? "auto"),
		sortCycle: options.sortCycle,
		columnsVisibility: options.visibility,
		columnsPinnable: options.pinning,
		columnsResizable: options.resizing,
		// The column follows the pointer as it is dragged, with a guide line down the table.
		columnsResizeMode: "onChange",
		columnsMovable: options.reordering,
		rowsDraggable: options.rowReorder,
		rowsPinnable: options.rowPinning,
		// Editing rides the engine's cell focus: ONE focused cell (no ranges, no clipboard writes), and its editor.
		cellSelection: options.editTrigger !== undefined,
		cellSelectionMode: "single",
		cellEditMode: options.editTrigger === "click" ? "click" : "dblclick",
	};
}

// On paper the card's frame and shadow are dropped: the table's own lines are enough.
const dataTableShellVariants = cva("w-full print:border-0 print:shadow-none print:ring-0", {
	variants: {
		state: {
			default: "",
			error: "border-destructive/40",
		},
	},
	defaultVariants: { state: "default" },
});

interface DataTableShellProps extends React.ComponentProps<typeof Card>, VariantProps<typeof dataTableShellVariants> {}

/** The card around the table: the element `DataTable`'s `ref` points at. */
const DataTableShell = React.forwardRef<HTMLDivElement, DataTableShellProps>(function DataTableShell({ className, state, ...props }, ref): React.JSX.Element {
	return <Card ref={ref} data-slot="data-table" className={cn(dataTableShellVariants({ state }), className)} {...props} />;
});

/** The cell-focus and editor controller, loaded only by a table that edits. */
const CellEditingController = React.lazy(async () => {
	const { TableEngineCellSelection } = await import("../internal/spreadsheet/cell-selection");
	return { default: TableEngineCellSelection };
});

/**
 * A records table: search, filters, sorting, paging (client, server or infinite), row and bulk actions, export, column
 * controls, tree and detail rows, row reordering and pinning, footers, virtual scrolling, mobile cards, saved
 * preferences, and loading, empty and error states. Each is switched on by its own prop.
 */
export function DataTable<TData extends RowData>(props: DataTableProps<TData>): React.JSX.Element {
	const {
		ref,
		data,
		heading,
		toolbar,
		footer,
		status,
		emptyState,
		filters,
		sorting,
		paging,
		onRowClick,
		rowActions,
		selection,
		exporting,
		rowReorder,
		rowPinning = false,
		rowStatus,
		draftRows,
		detail,
		columnControls,
		editing,
		layout,
		virtualize,
		mobileCard,
		labels: labelsOverride,
		className,
	} = props;
	const labels = useUiKitLabels("dataTable", labelsOverride);
	const engineLabels = useUiKitLabels("tableEngine", labelsOverride);
	const controller = useDataTableState(props, labels);
	const { table, mode } = controller;
	// Server snapshot `true`: SSR and hydration render the desktop layout first.
	const isDesktopViewport = useMediaQuery(DESKTOP_MEDIA_QUERY, true);
	// Cards follow the space the TABLE is given, not the window: a table in a narrow side panel on a wide screen turns
	// into cards too. Until the table is measured (the first render, the server) the window decides.
	const { ref: measureRef, width: tableWidth } = useElementWidth<HTMLDivElement>();
	const shellRef = React.useMemo(() => mergeRefs(ref, measureRef), [ref, measureRef]);
	const isNarrow = tableWidth === null ? !isDesktopViewport : tableWidth < CARD_LAYOUT_MAX_WIDTH_PX;

	const isServer = mode === "server";
	const isInfinite = mode === "infinite";
	const loading = status?.loading ?? false;
	const isInitialLoading = loading === "initial";
	const isRefreshing = loading === "refreshing";
	const errorMessage = status?.error ?? "";
	const hasError = errorMessage !== "";
	const hasRows = data.length > 0;

	const engineLayout = React.useMemo(
		(): TableEngineTableLayout =>
			toEngineLayout(layout, {
				density: controller.density,
				printing: controller.isPrinting,
				sortCycle: sorting?.cycle ?? "asc-desc",
				visibility: columnControls?.visibility === true,
				pinning: columnControls?.pinning === true,
				resizing: columnControls?.resizing === true,
				reordering: columnControls?.reordering === true,
				rowReorder: rowReorder !== undefined,
				rowPinning,
				editTrigger: editing === undefined ? undefined : (editing.trigger ?? "double-click"),
			}),
		[
			layout,
			controller.density,
			controller.isPrinting,
			sorting?.cycle,
			columnControls?.visibility,
			columnControls?.pinning,
			columnControls?.resizing,
			columnControls?.reordering,
			rowReorder,
			rowPinning,
			editing,
		],
	);

	// The engine reports every cell write as a batch; a records table takes the committed edits only (never a
	// clear, a cut, a paste or a fill, which belong to `Spreadsheet`). Saving, failed saves and undo live in the hook.
	const columnTitle = React.useCallback(
		(columnId: string): string => {
			const column = table.getColumn(columnId);
			return column === undefined ? columnId : getColumnHeaderLabel(column);
		},
		[table],
	);
	const cellEditing = useCellEditing({ editing, data, getRowId: props.getRowId, columnTitle, labels });
	const { handleCellsChange, undo, redo } = cellEditing;
	const hasHistory = editing?.history === true;

	// Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes, from anywhere in the table but a text field of its own.
	const handleHistoryKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (!hasHistory || !(event.ctrlKey || event.metaKey) || isTableEngineEditableTarget(event.target)) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key === "z" && !event.shiftKey) {
				event.preventDefault();
				undo();
			} else if ((key === "z" && event.shiftKey) || key === "y") {
				event.preventDefault();
				redo();
			}
		},
		[hasHistory, undo, redo],
	);

	// With a detail panel, a row click (or Enter on a row) opens that row's details, then runs the caller's own click.
	const isDetailPanel = detail?.mode === "panel";
	const { onPanelRowChange, onPanelStep, panelRowId } = controller;
	const readRowId = props.getRowId;
	const handleRowClick = React.useCallback(
		(row: TData): void => {
			if (isDetailPanel) {
				onPanelRowChange(readRowId(row));
			}
			void onRowClick?.(row);
		},
		[isDetailPanel, onPanelRowChange, readRowId, onRowClick],
	);
	const handlePanelClose = React.useCallback((): void => {
		onPanelRowChange(null);
	}, [onPanelRowChange]);
	const isRowClickable = onRowClick !== undefined || isDetailPanel;
	const panelIndex = panelRowId === null ? -1 : controller.visibleRows.findIndex((row) => row.id === panelRowId);
	const panelRow = panelRowId === null ? null : (data.find((row) => readRowId(row) === panelRowId) ?? null);
	const canPanelStepBack = panelIndex > 0;
	const canPanelStepForward = panelIndex >= 0 && panelIndex < controller.visibleRows.length - 1;
	const handleRowStatus = React.useCallback((row: TData): DataTableRowStatus | undefined => rowStatus?.(row), [rowStatus]);

	// ── Row reorder: the engine reports a drop; the caller is told which row moved onto which, by id ──────────
	const onReorder = rowReorder?.onReorder;
	const { visibleRows } = controller;
	const visibleRowIds = React.useMemo((): string[] => visibleRows.map((row) => row.id), [visibleRows]);
	const handleRowDragEnd = React.useCallback(
		(event: DragEndEvent): void => {
			const { active, over } = event;
			if (onReorder === undefined || over === null) {
				return;
			}
			// A drop on another branch, another level or the row itself moves nothing.
			const move = resolveDataTableRowMove(visibleRows, String(active.id), String(over.id));
			if (move !== null) {
				onReorder(move);
			}
		},
		[onReorder, visibleRows],
	);

	// ── What stands in for the rows ────────────────────────────────────────
	// "No rows at all" is the caller's empty state; "nothing matches" is the built-in one with "clear filters".
	const isEmptyTable = !isInitialLoading && !hasRows && !controller.isFiltered && (!isServer || controller.pageIndex === 0);
	const noResults = React.useMemo((): React.JSX.Element => <NoResults labels={labels} onClearFilters={controller.onClearFilters} />, [labels, controller.onClearFilters]);

	const resultCount: ToolbarResultCount | null = mode !== "server" && controller.isFiltered ? { filtered: controller.matchingCount, total: data.length } : null;

	const footerContent =
		footer === undefined || footer.rows.length === 0
			? undefined
			: footer.rows.map((footerRow) => (
					<TableEngineTableFootRow key={footerRow.key}>
						{table.getVisibleLeafColumns().map((column) => (
							<TableEngineTableFootRowCell key={column.id}>{footerRow.cells[column.id] ?? null}</TableEngineTableFootRowCell>
						))}
					</TableEngineTableFootRow>
				));

	const trailingMenus =
		exporting === undefined && columnControls?.visibility !== true && columnControls?.density !== true && !hasHistory ? null : (
			<>
				{hasHistory ? (
					<>
						<Button variant="outline" size="icon-sm" aria-label={labels.editUndo} title={labels.editUndo} disabled={!cellEditing.canUndo} onClick={undo}>
							<Undo2 aria-hidden="true" />
						</Button>
						<Button variant="outline" size="icon-sm" aria-label={labels.editRedo} title={labels.editRedo} disabled={!cellEditing.canRedo} onClick={redo}>
							<Redo2 aria-hidden="true" />
						</Button>
					</>
				) : null}
				{exporting === undefined ? null : exporting.mode === "dialog" ? (
					<ExportDialog
						table={table}
						columns={controller.columns}
						exporting={exporting}
						isServer={isServer}
						matchingCount={controller.matchingCount}
						labels={labels}
						onFetchAllMatching={controller.onFetchAllMatching}
					/>
				) : (
					<ExportMenu table={table} columns={controller.columns} exporting={exporting} labels={labels} onFetchAllMatching={controller.onFetchAllMatching} />
				)}
				{columnControls?.density === true ? <DensityMenu density={controller.density} onDensityChange={controller.onDensityChange} labels={labels} /> : null}
				{columnControls?.visibility === true ? (
					<TableEngineColumnVisibility
						table={table}
						trigger={
							<Button variant="outline" className={TOOLBAR_MENU_TRIGGER_CLASS_NAME}>
								<Columns3 className="size-4" aria-hidden="true" />
								<span>{labels.columnsToggle}</span>
							</Button>
						}
					/>
				) : null}
			</>
		);

	// Paper always gets the table, never the cards: a printed list is read across, column by column.
	const showCards = mobileCard !== undefined && isNarrow && !isInitialLoading && !controller.isPrinting;
	const showPager = !isInfinite && (isServer ? controller.matchingCount > 0 || controller.pageIndex > 0 || hasRows : paging !== undefined && controller.matchingCount > 0);
	const maxHeight = layout?.maxHeight;
	// A printed table is not a scrolling box: it grows to hold every row, so the height limit is dropped on paper.
	const isPrinting = controller.isPrinting;
	const scrollAreaStyle = React.useMemo((): React.CSSProperties | undefined => (maxHeight === undefined || isPrinting ? undefined : { maxHeight }), [maxHeight, isPrinting]);
	const usesVirtualRows = isInfinite || virtualize?.rows === true || virtualize?.columns === true;

	const infiniteSource = props.source?.mode === "infinite" ? props.source : undefined;

	const tableBody =
		rowReorder !== undefined ? (
			<TableEngineTableDndRows handleDragEnd={handleRowDragEnd} dataIds={visibleRowIds} footerContent={footerContent} />
		) : usesVirtualRows ? (
			<TableEngineTableVirtual
				footerContent={footerContent}
				{...(virtualize?.estimateRowHeight === undefined ? {} : { estimateSize: virtualize.estimateRowHeight })}
				{...(virtualize?.columns === true ? { columnVirtualizerOptions: { enabled: true } } : {})}
				{...(infiniteSource === undefined ? {} : { onFetchMore: infiniteSource.onLoadMore, isFetchingMore: infiniteSource.isFetchingMore, hasMore: infiniteSource.hasMore })}
			/>
		) : (
			<TableEngineTable footerContent={footerContent} />
		);

	return (
		<DataTableShell
			ref={shellRef}
			state={hasError ? "error" : "default"}
			data-density={controller.density}
			className={className}
			onKeyDown={hasHistory ? handleHistoryKeyDown : undefined}>
			{cellEditing.announcement === "" ? null : (
				<span role="status" className="sr-only">
					{cellEditing.announcement}
				</span>
			)}
			{heading === undefined ? null : (
				<CardHeader>
					{heading.title === undefined ? null : <CardTitle>{heading.title}</CardTitle>}
					{heading.description === undefined ? null : <CardDescription>{heading.description}</CardDescription>}
					{heading.actions === undefined ? null : <CardAction>{heading.actions}</CardAction>}
				</CardHeader>
			)}
			<CardContent>
				<TableEngine
					table={table}
					recordCount={controller.matchingCount}
					isLoading={isInitialLoading}
					loadingMode="skeleton"
					skeletonRowCount={status?.skeletonRows ?? DEFAULT_SKELETON_ROWS}
					emptyMessage={noResults}
					tableLayout={engineLayout}
					labels={labelsOverride}
					onRowClick={isRowClickable ? handleRowClick : undefined}
					activeRowId={panelRowId ?? undefined}
					getRowStatus={rowStatus === undefined ? undefined : handleRowStatus}
					// Paper gets no "add row" button.
					onRowCreate={isPrinting ? undefined : draftRows?.onCreate}
					rowCreateLabel={draftRows?.label}
					getCellStatus={cellEditing.getCellStatus}
					onCellsChange={editing === undefined ? undefined : handleCellsChange}>
					{selection === undefined || isPrinting ? null : (
						<SelectionIsland
							table={table}
							selection={selection}
							scope={controller.scope}
							onScopeChange={controller.onScopeChange}
							totalMatchingRows={controller.matchingCount}
							canSelectAllMatching={!isServer || controller.onFetchAllMatching !== undefined}
							showSelectAllWhenEmpty={showCards}
							labels={labels}
						/>
					)}

					<Toolbar
						layout={toolbar?.layout ?? "inline"}
						search={controller.search}
						filters={filters ?? []}
						filterValues={controller.filterValues}
						filterCounts={controller.filterCounts}
						filteredCount={controller.matchingCount}
						resultCount={resultCount}
						extra={toolbar?.extra}
						trailing={trailingMenus}
						labels={labels}
						engineLabels={engineLabels}
						onFilterChange={controller.onFilterChange}
					/>

					{hasError && !hasRows ? (
						<ErrorState message={errorMessage} labels={labels} onRetry={status?.onRetry} />
					) : isEmptyTable ? (
						<EmptyState emptyState={emptyState} labels={labels} />
					) : (
						<>
							{/* An error over rows already on screen: keep the rows, say what went wrong above them. */}
							{hasError ? (
								<div role="alert" className="mb-3 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
									<CircleAlert className="size-4 shrink-0" aria-hidden="true" />
									<span className="min-w-0 flex-1">{errorMessage}</span>
									{status?.onRetry === undefined ? null : (
										<Button variant="outline" size="sm" onClick={status.onRetry}>
											{labels.retry}
										</Button>
									)}
								</div>
							) : null}

							{isInitialLoading ? (
								<span role="status" className="sr-only">
									{labels.loadingTableAriaLabel}
								</span>
							) : null}

							{/* The rows and, beside them, the detail panel when one is open on a wide table. */}
							<div className={cn("flex items-start gap-4", isDetailPanel && panelRow !== null && !isNarrow ? undefined : "contents")}>
								<div className="min-w-0 flex-1">
									{showCards ? (
										<div className={cn("space-y-4 transition-opacity duration-150", isRefreshing ? "opacity-60" : undefined)}>
											{table.getRowModel().rows.length === 0
												? noResults
												: table
														.getRowModel()
														.rows.map((row) => (
															<MobileCardView
																key={row.id}
																row={row}
																isSelectable={selection !== undefined}
																mobileCard={mobileCard}
																rowActions={rowActions ?? NO_ROW_ACTIONS}
																onRowClick={isRowClickable ? handleRowClick : undefined}
															/>
														))}
										</div>
									) : (
										<TableEngineContainer
											variant="records"
											aria-busy={isInitialLoading || isRefreshing ? true : undefined}
											className={cn("transition-opacity duration-150", isRefreshing ? "opacity-60" : undefined)}>
											<TableEngineScrollArea style={scrollAreaStyle}>{tableBody}</TableEngineScrollArea>
											{editing === undefined ? null : (
												<React.Suspense fallback={null}>
													<CellEditingController clipboard={false} />
												</React.Suspense>
											)}
										</TableEngineContainer>
									)}
								</div>
								{isDetailPanel && !isPrinting ? (
									<DetailPanel
										row={panelRow}
										detail={detail}
										isNarrow={isNarrow}
										canStepBack={canPanelStepBack}
										canStepForward={canPanelStepForward}
										labels={labels}
										onStep={onPanelStep}
										onClose={handlePanelClose}
									/>
								) : null}
							</div>

							{showPager ? (
								<Pager
									pageIndex={controller.pageIndex}
									pageSize={controller.pageSize}
									totalCount={controller.matchingCount}
									pageSizeOptions={controller.pageSizeOptions}
									isRefreshing={isRefreshing}
									labels={labels}
									engineLabels={engineLabels}
									onPageChange={controller.onPageChange}
									onPageSizeChange={controller.onPageSizeChange}
								/>
							) : null}
						</>
					)}
				</TableEngine>
			</CardContent>
		</DataTableShell>
	);
}
