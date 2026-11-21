"use client";

// DataTable's export menu: one entry per format. It exports the ticked rows when there are any; otherwise every row
// that matches the filters (fetched through `onFetchAllMatching` on a server-paged table, which holds one page).

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/core/utils";
import { buildExportColumns, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet } from "@workspace/ui/lib/table/export";
import { DATA_TABLE_EXPORT_FORMATS, resolveDataTableColumnId, type DataTableExportFormat, type DataTableLabels } from "@workspace/ui-kit-logic";
import { Subscribe, type RowData } from "@tanstack/react-table";
import { FileDown } from "lucide-react";
import * as React from "react";

import type { DataTableColumns, DataTableExporting } from "./props";
import { memoGeneric, TOOLBAR_MENU_TRIGGER_CLASS_NAME, type DataTableInstance } from "./shared";

/**
 * The rows an export covers: the ticked rows, else every matching row. `flatRows`, not `rows`: in a tree `rows` holds
 * the top level only, and an export would leave every child row out.
 */
export function resolveExportRows<TData extends RowData>(table: DataTableInstance<TData>, onFetchAllMatching: (() => Promise<TData[]>) | undefined): Promise<TData[]> {
	const selectedRows = table.getSelectedRowModel().flatRows;
	if (selectedRows.length > 0) {
		return Promise.resolve(selectedRows.map((row) => row.original));
	}
	if (onFetchAllMatching !== undefined) {
		return onFetchAllMatching();
	}
	return Promise.resolve(table.getFilteredRowModel().flatRows.map((row) => row.original));
}

/** One export format's menu entry: its handler, copy and tile colours. */
export interface ExportFormatOption {
	readonly format: DataTableExportFormat;
	readonly labelKey: "exportCsv" | "exportJson" | "exportPdf" | "exportSpreadsheet";
	readonly descriptionKey: "exportCsvDescription" | "exportJsonDescription" | "exportPdfDescription" | "exportSpreadsheetDescription";
	readonly tileClassName: string;
	readonly iconClassName: string;
	readonly resolveFilename: (filename: string | undefined) => string;
	readonly exportRows: <TData extends RowData>(rows: TData[], columns: DataTableColumns<TData>, filename: string) => void;
}

/** CSV keeps the full file name (default `export.csv`); the others get it without its extension. */
export const csvExportFilename = (filename: string | undefined): string => filename ?? "export.csv";
export const baseExportFilename = (filename: string | undefined): string => filename?.replace(/\.\w+$/, "") ?? "export";

/** Menu order: CSV, JSON, PDF, spreadsheet. */
export const EXPORT_FORMAT_OPTIONS: readonly ExportFormatOption[] = [
	{
		format: "csv",
		labelKey: "exportCsv",
		descriptionKey: "exportCsvDescription",
		tileClassName: "bg-success-soft",
		iconClassName: "text-success",
		resolveFilename: csvExportFilename,
		exportRows: exportToCSV,
	},
	{
		format: "json",
		labelKey: "exportJson",
		descriptionKey: "exportJsonDescription",
		tileClassName: "bg-info-soft",
		iconClassName: "text-info",
		resolveFilename: baseExportFilename,
		exportRows: exportToJSON,
	},
	{
		format: "pdf",
		labelKey: "exportPdf",
		descriptionKey: "exportPdfDescription",
		tileClassName: "bg-destructive-soft",
		iconClassName: "text-destructive",
		resolveFilename: baseExportFilename,
		exportRows: exportToPDF,
	},
	{
		format: "xlsx",
		labelKey: "exportSpreadsheet",
		descriptionKey: "exportSpreadsheetDescription",
		tileClassName: "bg-success-soft",
		iconClassName: "text-success",
		resolveFilename: baseExportFilename,
		exportRows: exportToSpreadsheet,
	},
];

/** What an export can write, and what it writes unless the reader picks otherwise. */
export interface ExportColumnChoice<TData extends RowData> {
	/** Everything the export can write, in order: the `keys` first (when given), then the table's other data columns. */
	readonly available: DataTableColumns<TData>;
	/** The ids the menu writes, and the dialog ticks to start with. */
	readonly initial: readonly string[];
}

/**
 * What an export offers: every data column (never a utility column), with `keys` first, in their order. Each key is
 * the column that shows it or, when no column does, a bare id the export reads from the row. The keys are what is
 * written; without them, every data column is.
 */
export function resolveExportColumns<TData extends RowData>(columns: DataTableColumns<TData>, keys: readonly string[] | undefined): ExportColumnChoice<TData> {
	const dataColumns = buildExportColumns(columns);
	const dataColumnIds = dataColumns.flatMap((column) => resolveDataTableColumnId(column) ?? []);
	if (keys === undefined || keys.length === 0) {
		return { available: dataColumns, initial: dataColumnIds };
	}
	const keyColumns = keys.map((key): DataTableColumns<TData>[number] => dataColumns.find((column) => resolveDataTableColumnId(column) === key) ?? { id: key });
	const otherColumns = dataColumns.filter((column) => !keys.includes(resolveDataTableColumnId(column) ?? ""));
	return { available: [...keyColumns, ...otherColumns], initial: [...keys] };
}

/** The columns an export writes: the chosen ids, in the order the choice lists them (not the order they were picked). */
export function pickExportColumns<TData extends RowData>(choice: ExportColumnChoice<TData>, chosen: readonly string[]): DataTableColumns<TData> {
	return choice.available.filter((column) => chosen.includes(resolveDataTableColumnId(column) ?? ""));
}

interface ExportItemProps<TData extends RowData> {
	readonly option: ExportFormatOption;
	readonly table: DataTableInstance<TData>;
	readonly columns: DataTableColumns<TData>;
	readonly filename: string | undefined;
	readonly labels: DataTableLabels;
	readonly onFetchAllMatching: (() => Promise<TData[]>) | undefined;
}

const ExportItem = memoGeneric(function ExportItem<TData extends RowData>({
	option,
	table,
	columns,
	filename,
	labels,
	onFetchAllMatching,
}: ExportItemProps<TData>): React.JSX.Element {
	// The handler reads the selection at click time, so the menu never exports a stale row set.
	const handleClick = React.useCallback((): void => {
		void resolveExportRows(table, onFetchAllMatching).then((rows) => {
			option.exportRows(rows, columns, option.resolveFilename(filename));
		});
	}, [option, table, columns, filename, onFetchAllMatching]);

	return (
		<DropdownMenuItem onClick={handleClick} highlight="soft" className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
			<div className={cn("flex size-7 items-center justify-center rounded-md", option.tileClassName)}>
				<FileDown className={cn("size-3.5", option.iconClassName)} aria-hidden="true" />
			</div>
			<div className="flex flex-col">
				<span className="text-sm font-medium">{labels[option.labelKey]}</span>
				<span className="text-xs text-muted-foreground">{labels[option.descriptionKey]}</span>
			</div>
		</DropdownMenuItem>
	);
});

export interface ExportMenuProps<TData extends RowData> {
	readonly table: DataTableInstance<TData>;
	/** The table's column definitions, utility columns included (they are left out here). */
	readonly columns: DataTableColumns<TData>;
	readonly exporting: DataTableExporting<TData>;
	readonly labels: DataTableLabels;
	readonly onFetchAllMatching: (() => Promise<TData[]>) | undefined;
}

export const ExportMenu = memoGeneric(function ExportMenu<TData extends RowData>({
	table,
	columns,
	exporting,
	labels,
	onFetchAllMatching,
}: ExportMenuProps<TData>): React.JSX.Element {
	const exportColumns = React.useMemo((): DataTableColumns<TData> => {
		const choice = resolveExportColumns(columns, exporting.keys);
		return pickExportColumns(choice, choice.initial);
	}, [columns, exporting.keys]);
	const formats = exporting.formats ?? DATA_TABLE_EXPORT_FORMATS;

	const renderMenu = (): React.JSX.Element => (
		<DropdownMenu>
			<DropdownMenuTrigger className={TOOLBAR_MENU_TRIGGER_CLASS_NAME}>
				<FileDown className="size-4" aria-hidden="true" />
				<span>{labels.export}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52 p-1.5">
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">{labels.exportAs}</div>
				{EXPORT_FORMAT_OPTIONS.filter((option) => formats.includes(option.format)).map((option) => (
					<ExportItem
						key={option.format}
						option={option}
						table={table}
						columns={exportColumns}
						filename={exporting.filename}
						labels={labels}
						onFetchAllMatching={onFetchAllMatching}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	// The menu follows the selection (which rows an export covers), without the toolbar around it re-rendering.
	return <Subscribe source={table.atoms.rowSelection}>{renderMenu}</Subscribe>;
});
