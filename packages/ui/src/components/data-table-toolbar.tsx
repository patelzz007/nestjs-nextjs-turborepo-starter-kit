"use client";

// DataTable's toolbar and selection bars (enhancement 8.1: split from data-table.tsx): export, column visibility,
// the filter selects and the bulk actions.

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { type Column, type ColumnDef, type ColumnVisibilityState, type RowData, Subscribe, type Table as TanStackTable } from "@tanstack/react-table";
import { Columns3, FileDown, ListFilter } from "lucide-react";
import * as React from "react";
import { useCallback, useMemo } from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { buildExportColumns, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet } from "@workspace/ui/lib/data-table/export";
import { type DataTableBulkAction, type DataTableBulkSelectionContext, type DataTableExportFormat, includesExportFormat } from "@workspace/ui/lib/data-table/checkbox";
import { type DataTableLabels, formatDataTableLabel } from "@workspace/ui/lib/data-table/labels";
import { SelectAllCheckbox } from "./data-table-rows";
import { bulkSelectionSurfaceClasses, columnHeaderLabelSchema, memoGeneric } from "./data-table-shared";
import { type DataTableFeatures, type Filter } from "./data-table-types";

export interface ExportMenuProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	readonly exportFilename?: string | undefined;
	readonly exportableColumns?: string[] | undefined;
	readonly exportFormats: readonly DataTableExportFormat[];
	readonly labels: DataTableLabels;
	readonly isServerMode: boolean;
	readonly onFetchAllMatching?: (() => Promise<TData[]>) | undefined;
}

/** Selection-aware row projection used by every export format. */
export function resolveExportRows<TData extends RowData>(
	table: TanStackTable<DataTableFeatures, TData>,
	isServerMode: boolean,
	onFetchAllMatching?: () => Promise<TData[]>,
): Promise<TData[]> {
	const selectedRows = table.getSelectedRowModel().rows;
	if (selectedRows.length > 0) {
		return Promise.resolve(selectedRows.map((row) => row.original));
	}
	if (isServerMode && onFetchAllMatching !== undefined) {
		return onFetchAllMatching();
	}
	return Promise.resolve(table.getFilteredRowModel().rows.map((row) => row.original));
}

/** One export format's menu entry: its handler, copy and tile colours. */
export interface ExportFormatOption {
	readonly format: DataTableExportFormat;
	readonly labelKey: keyof DataTableLabels;
	readonly descriptionKey: keyof DataTableLabels;
	readonly tileClassName: string;
	readonly iconClassName: string;
	readonly resolveFilename: (exportFilename: string | undefined) => string;
	readonly exportRows: <TData extends RowData>(rows: TData[], columns: ColumnDef<DataTableFeatures, TData>[], filename: string) => void;
}

/** CSV keeps the full filename (default `export.csv`); the others get it without its extension. */
export const csvExportFilename = (exportFilename: string | undefined): string => exportFilename ?? "export.csv";
export const baseExportFilename = (exportFilename: string | undefined): string => exportFilename?.replace(/\.\w+$/, "") ?? "export";

/** Menu order: CSV, JSON, PDF, spreadsheet. */
export const EXPORT_FORMAT_OPTIONS: readonly ExportFormatOption[] = [
	{
		format: "csv",
		labelKey: "exportCsv",
		descriptionKey: "exportCsvDescription",
		tileClassName: "bg-success-soft dark:bg-success-soft",
		iconClassName: "text-green-600 dark:text-green-400",
		resolveFilename: csvExportFilename,
		exportRows: exportToCSV,
	},
	{
		format: "json",
		labelKey: "exportJson",
		descriptionKey: "exportJsonDescription",
		tileClassName: "bg-info-soft dark:bg-info-soft/30",
		iconClassName: "text-info",
		resolveFilename: baseExportFilename,
		exportRows: exportToJSON,
	},
	{
		format: "pdf",
		labelKey: "exportPdf",
		descriptionKey: "exportPdfDescription",
		tileClassName: "bg-destructive-soft dark:bg-destructive-soft",
		iconClassName: "text-destructive",
		resolveFilename: baseExportFilename,
		exportRows: exportToPDF,
	},
	{
		format: "xlsx",
		labelKey: "exportSpreadsheet",
		descriptionKey: "exportSpreadsheetDescription",
		tileClassName: "bg-success-soft dark:bg-success-soft",
		iconClassName: "text-success",
		resolveFilename: baseExportFilename,
		exportRows: exportToSpreadsheet,
	},
];

export interface ExportItemProps<TData extends RowData> {
	readonly option: ExportFormatOption;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly exportCols: ColumnDef<DataTableFeatures, TData>[];
	readonly exportFilename?: string | undefined;
	readonly labels: DataTableLabels;
	readonly isServerMode: boolean;
	readonly onFetchAllMatching?: (() => Promise<TData[]>) | undefined;
}

export const ExportItem = memoGeneric(function ExportItem<TData extends RowData>({
	option,
	table,
	exportCols,
	exportFilename,
	labels,
	isServerMode,
	onFetchAllMatching,
}: ExportItemProps<TData>): React.JSX.Element {
	// Stable handler (rule 16): it reads the selection-fresh row set at click
	// time, so the menu never ships stale rows even though the parent doesn't
	// re-render on selection changes (#6).
	const handleClick = useCallback((): void => {
		void resolveExportRows(table, isServerMode, onFetchAllMatching).then((rows) => {
			option.exportRows(rows, exportCols, option.resolveFilename(exportFilename));
		});
	}, [option, table, exportCols, exportFilename, isServerMode, onFetchAllMatching]);

	return (
		<DropdownMenuItem onClick={handleClick} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
			<div className={`flex h-7 w-7 items-center justify-center rounded-md ${option.tileClassName}`}>
				<FileDown className={`h-3.5 w-3.5 ${option.iconClassName}`} />
			</div>
			<div className="flex flex-col">
				<span className="text-sm font-medium">{labels[option.labelKey]}</span>
				<span className="text-[10px] text-muted-foreground">{labels[option.descriptionKey]}</span>
			</div>
		</DropdownMenuItem>
	);
});

export const ExportMenu = memoGeneric(function ExportMenu<TData extends RowData>({
	table,
	columns,
	exportFilename,
	exportableColumns,
	exportFormats,
	labels,
	isServerMode,
	onFetchAllMatching,
}: ExportMenuProps<TData>): React.JSX.Element {
	const exportCols = useMemo((): ColumnDef<DataTableFeatures, TData>[] => {
		const base = buildExportColumns(columns);
		if (exportableColumns !== undefined && exportableColumns.length > 0) {
			return base.filter((col) => {
				const key = "id" in col ? col.id : "accessorKey" in col ? String(col.accessorKey) : undefined;
				return key !== undefined && exportableColumns.includes(key);
			});
		}
		return base;
	}, [columns, exportableColumns]);

	// Selection-aware export: selected rows first, else the filtered set.
	const renderMenu = (): React.JSX.Element => (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground">
				<FileDown className="h-4 w-4" />
				<span>{labels.export}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44 p-1.5">
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">{labels.exportAs}</div>
				{EXPORT_FORMAT_OPTIONS.map((option) =>
					includesExportFormat(exportFormats, option.format) ? (
						<ExportItem
							key={option.format}
							option={option}
							table={table}
							exportCols={exportCols}
							exportFilename={exportFilename}
							labels={labels}
							isServerMode={isServerMode}
							onFetchAllMatching={onFetchAllMatching}
						/>
					) : null,
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	// Re-render the menu (and thus recompute the exported row set) whenever the
	// selection slice changes — the parent does not subscribe to it (#6).
	return <Subscribe source={table.atoms.rowSelection}>{renderMenu}</Subscribe>;
});

// ── Column Visibility Dropdown (sub-component: per-column toggles live here) ─

export interface ColumnVisibilityMenuProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly columnVisibility: ColumnVisibilityState;
	readonly onVisibilityChange: (visibility: ColumnVisibilityState) => void;
	readonly labels: DataTableLabels;
}

export const ColumnVisibilityItem = memoGeneric(function ColumnVisibilityItem<TData extends RowData>({
	col,
	onToggle,
}: {
	readonly col: Column<DataTableFeatures, TData>;
	readonly onToggle: (col: Column<DataTableFeatures, TData>) => void;
}): React.JSX.Element {
	const handleCheckedChange = useCallback((): void => {
		onToggle(col);
	}, [col, onToggle]);

	const header = col.columnDef.header;
	const parsedHeader = columnHeaderLabelSchema.safeParse(header);
	const label = parsedHeader.success ? parsedHeader.data : col.id;

	return (
		<DropdownMenuCheckboxItem checked={col.getIsVisible()} onCheckedChange={handleCheckedChange}>
			{label}
		</DropdownMenuCheckboxItem>
	);
});

export const ColumnVisibilityMenu = memoGeneric(function ColumnVisibilityMenu<TData extends RowData>({
	table,
	columnVisibility,
	onVisibilityChange,
	labels,
}: ColumnVisibilityMenuProps<TData>): React.JSX.Element {
	const columns = useMemo(() => table.getAllLeafColumns().filter((col) => col.getCanHide()), [table]);

	const handleToggle = useCallback(
		(col: Column<DataTableFeatures, TData>): void => {
			// v9's `table.state` is intentionally opaque — compute the next
			// visibility from the component's own snapshot instead of reading it.
			col.toggleVisibility(!col.getIsVisible());
			onVisibilityChange({ ...columnVisibility, [col.id]: !col.getIsVisible() });
		},
		[columnVisibility, onVisibilityChange],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground">
				<Columns3 className="h-4 w-4" />
				<span>{labels.columnsToggle}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{columns.map((col) => (
					<ColumnVisibilityItem key={col.id} col={col} onToggle={handleToggle} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

// ── Column Filter Select (sub-component: the per-filter closure lives here) ──

export interface ColumnFilterSelectProps {
	readonly filter: Filter;
	readonly value: string;
	/**
	 * Counts are only true on a client-side table, which holds every row. A
	 * server-paged table holds one page, so "All (50)" would count the page,
	 * not the matches — it shows plain "All" instead.
	 */
	readonly showCounts: boolean;
	readonly totalFilteredRows: number;
	readonly facetedCounts: ReadonlyMap<string, number>;
	readonly onFilterChange: (filterKey: string, value: string | null) => void;
	/** Fill the cell the toolbar gives it (`toolbarLayout="fill"`) instead of sizing to the label. */
	readonly fillWidth?: boolean;
}

export const ColumnFilterSelect = React.memo(function ColumnFilterSelect({
	filter,
	value,
	showCounts,
	totalFilteredRows,
	facetedCounts,
	onFilterChange,
	fillWidth = false,
}: ColumnFilterSelectProps): React.JSX.Element {
	const handleValueChange = useCallback(
		(next: string | null): void => {
			onFilterChange(filter.key, next);
		},
		[filter, onFilterChange],
	);

	// One option list feeds both the Root's `items` (the closed trigger's label)
	// and the rendered `SelectItem`s, so the trigger always shows exactly the
	// selected item's text — faceted count included.
	const options = useMemo(
		(): readonly SelectOption<string>[] => [
			{ value: "all", label: showCounts ? `All (${String(totalFilteredRows)})` : "All" },
			...filter.options.map((option): SelectOption<string> => {
				const count = showCounts ? facetedCounts.get(option.value) : undefined;
				return { value: option.value, label: count !== undefined ? `${option.label} (${String(count)})` : option.label };
			}),
		],
		[facetedCounts, filter.options, showCounts, totalFilteredRows],
	);

	// Icons are opt-in per option; "All" gets one only when the others do, so the labels line up.
	const icons = useMemo((): ReadonlyMap<string, React.ReactNode> => {
		const given = filter.options.filter((option) => option.icon !== undefined);
		const byValue = new Map<string, React.ReactNode>(given.map((option) => [option.value, option.icon]));
		if (byValue.size > 0) {
			byValue.set("all", <ListFilter />);
		}
		return byValue;
	}, [filter.options]);

	const nameId = React.useId();

	// The filter's name stays visible in front of its choice ("Source: All"), so a row of
	// dropdowns never reads as a row of identical "All"s. That visible text is also its accessible
	// name (WCAG 2.5.3): a combobox takes no name from its content, and an `aria-label` of the name
	// alone would leave out the choice it shows, so the trigger is labelled by the text it displays.
	return (
		<Select<string> value={value} onValueChange={handleValueChange} items={options}>
			<SelectTrigger className={cn("h-9 w-full text-sm", fillWidth ? "sm:min-w-0" : "sm:w-auto sm:min-w-44")} aria-labelledby={nameId}>
				<span id={nameId} className="flex min-w-0 items-center gap-1.5">
					<span className="shrink-0 text-muted-foreground" data-slot="filter-label">
						{filter.label}:
					</span>
					<SelectValue placeholder={filter.label} className="truncate font-medium" />
				</span>
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{icons.has(option.value) ? (
							<span className="flex min-w-0 items-center gap-2">
								<span aria-hidden="true" data-slot="filter-option-icon" className="flex shrink-0 opacity-70">
									{icons.get(option.value)}
								</span>
								<span className="truncate">{option.label}</span>
							</span>
						) : (
							option.label
						)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});

// ── No-results state (filters/search matched nothing) ─────────────────────

export interface BulkActionButtonProps<TData extends RowData> {
	readonly action: DataTableBulkAction<TData>;
	readonly selectedRows: TData[];
	readonly selectionContext: DataTableBulkSelectionContext;
	readonly onDone: () => void;
}

export const BulkActionButton = memoGeneric(function BulkActionButton<TData extends RowData>({
	action,
	selectedRows,
	selectionContext,
	onDone,
}: BulkActionButtonProps<TData>): React.JSX.Element {
	const handleClick = useCallback((): void => {
		// onClick may be sync (void) or async — normalize so the
		// row-selection reset always runs after the action settles.
		void Promise.resolve(action.onClick(selectedRows, selectionContext)).then(onDone);
	}, [action, selectedRows, selectionContext, onDone]);
	const [shortLabel] = action.label.split(" ");

	return (
		<Button
			variant={action.variant === "destructive" ? "outline" : (action.variant ?? "outline")}
			size="sm"
			onClick={handleClick}
			className={cn(
				"shrink-0 gap-1.5 text-xs sm:text-sm",
				action.variant === "destructive" && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
			)}>
			{action.icon}
			<span className="hidden sm:inline">{action.label}</span>
			<span className="sm:hidden">{shortLabel}</span>
		</Button>
	);
});

// ── Page Number Button (sub-component: the per-page closure lives here) ─────

export interface BulkSelectionBarProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly bulkActions: DataTableBulkAction<TData>[];
	readonly selectedRows: TData[];
	readonly selectionContext: DataTableBulkSelectionContext;
	readonly selectAllPages: boolean;
	readonly totalFilteredRows: number;
	readonly labels: DataTableLabels;
	readonly onAnyDeselect: () => void;
	readonly onBulkActionDone: () => void;
	readonly onClearSelection: () => void;
}

export const BulkSelectionBar = memoGeneric(function BulkSelectionBar<TData extends RowData>({
	table,
	bulkActions,
	selectedRows,
	selectionContext,
	selectAllPages,
	totalFilteredRows,
	labels,
	onAnyDeselect,
	onBulkActionDone,
	onClearSelection,
}: BulkSelectionBarProps<TData>): React.JSX.Element {
	return (
		<div className={bulkSelectionSurfaceClasses}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<SelectAllCheckbox table={table} onAnyDeselect={onAnyDeselect} labels={labels} />
					<span className="text-sm font-medium text-foreground">
						{selectAllPages ? (
							<>{formatDataTableLabel(labels.allRowsSelected, { totalCount: totalFilteredRows })}</>
						) : selectedRows.length === 1 ? (
							<>{labels.selectedRowCount}</>
						) : (
							<>{formatDataTableLabel(labels.selectedRowsCount, { count: selectedRows.length })}</>
						)}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{bulkActions.length > 0
						? bulkActions.map((action) => (
								<BulkActionButton key={action.key} action={action} selectedRows={selectedRows} selectionContext={selectionContext} onDone={onBulkActionDone} />
							))
						: null}
					<Button variant="ghost" size="sm" onClick={onClearSelection} className="shrink-0 text-xs sm:text-sm">
						{labels.clearSelection}
					</Button>
				</div>
			</div>
		</div>
	);
});

// ── Mobile selection bar (visible before rows are selected on small screens) ─

export interface MobileSelectionBarProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly selectedCount: number;
	readonly labels: DataTableLabels;
	readonly onAnyDeselect: () => void;
	readonly onClearSelection: () => void;
}

export const MobileSelectionBar = memoGeneric(function MobileSelectionBar<TData extends RowData>({
	table,
	selectedCount,
	labels,
	onAnyDeselect,
	onClearSelection,
}: MobileSelectionBarProps<TData>): React.JSX.Element {
	return (
		<div className={bulkSelectionSurfaceClasses}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<SelectAllCheckbox table={table} onAnyDeselect={onAnyDeselect} labels={labels} />
					<span className="text-sm font-medium text-foreground">
						{selectedCount > 0 ? <>{formatDataTableLabel(labels.selectedRowsCount, { count: selectedCount })}</> : labels.mobileSelectAll}
					</span>
				</div>
				{selectedCount > 0 ? (
					<Button variant="ghost" size="sm" onClick={onClearSelection} className="h-8 px-2">
						{labels.clearSelection}
					</Button>
				) : null}
			</div>
		</div>
	);
});

// ── DataTable Component ────────────────────────────────────────────────────
