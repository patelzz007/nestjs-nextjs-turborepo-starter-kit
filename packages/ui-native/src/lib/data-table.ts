// The native DataTable's pure rules: its default copy, the sort cycle, how an edited cell's text becomes a value,
// the page range a footer reads out, and the file an export hands on. The rules the web kit shares (preferences,
// column ids, selection config, export documents) live in @workspace/ui-kit-logic.

import {
	buildCsvText,
	buildJsonText,
	buildPrintHtml,
	buildSpreadsheetXml,
	DataTableCellScalarSchema,
	sanitizeExportFilename,
	type DataTableCellInput,
	type DataTableCellScalar,
	type DataTableExportFormat,
	type DataTableLabels,
} from "@workspace/ui-kit-logic";
import { z } from "zod";

/** The copy the native table adds to the web's: what a phone says where the web has a pointer. */
export interface NativeDataTableLabels extends DataTableLabels {
	/** A sorted header's state, read after its name. */
	readonly sortedAscending: string;
	readonly sortedDescending: string;
	/** What pressing a sortable header does. */
	readonly sortHint: string;
	/** e.g. `Edit {column}`: a cell that edits in place. */
	readonly editCell: string;
	/** e.g. `Select {row}`: a row's checkbox, named by the row. */
	readonly selectNamedRow: string;
	/** A filter's choice that keeps every row. */
	readonly filterAll: string;
	/** The error state's retry button. */
	readonly retry: string;
	/** The page-size menu's title. */
	readonly pageSizeTitle: string;
	/** e.g. `{count} per page`: a page-size choice. */
	readonly pageSizeOption: string;
	/** e.g. `Pin {column}`: a column's row in the columns menu's pin group. */
	readonly pinNamedColumn: string;
}

/** The English copy, the web's (`en.json`) plus the native additions. */
export const DEFAULT_DATA_TABLE_LABELS: NativeDataTableLabels = {
	actionsMenuTitle: "Actions",
	openRowMenu: "Open row menu",
	actionsColumnHeader: "Actions",
	searchPlaceholder: "Search...",
	searchAriaLabel: "Search rows",
	clearSearchAriaLabel: "Clear search",
	noDataTitle: "No data available",
	noDataDescription: "Get started by adding your first item.",
	noResultsTitle: "No results found",
	noResultsDescription: "Try adjusting your search or filter criteria to find what you're looking for.",
	clearFilters: "Clear filters",
	selectAllAriaLabel: "Select all",
	selectRowAriaLabel: "Select row",
	selectAllPageRowsSelected: "All {pageCount} rows on this page are selected.",
	selectAllFilteredRows: "Select all {totalCount} rows",
	selectedRowCount: "1 row selected",
	selectedRowsCount: "{count} rows selected",
	allRowsSelected: "All {totalCount} rows selected",
	clearSelection: "Clear",
	deleteSelected: "Delete selected",
	mobileSelectAll: "Select all",
	export: "Export",
	exportAs: "Export as",
	exportCsv: "CSV",
	exportCsvDescription: "Comma-separated values",
	exportJson: "JSON",
	exportJsonDescription: "JavaScript object notation",
	exportPdf: "PDF",
	exportPdfDescription: "Portable document format",
	exportSpreadsheet: "Spreadsheet",
	exportSpreadsheetDescription: "Excel-compatible .xls",
	columnsToggle: "Columns",
	resultsCount: "{filtered} of {total} results",
	showingResults: "Showing {from} to {to} of {total} results",
	showPerPage: "Show",
	perPage: "per page",
	showingPageCount: "Showing {count} results",
	pageOfTotal: "Page {page} of {totalPages}",
	firstPageAriaLabel: "Go to first page",
	previousPageAriaLabel: "Go to previous page",
	nextPageAriaLabel: "Go to next page",
	lastPageAriaLabel: "Go to last page",
	goToPageAriaLabel: "Go to page {page}",
	pinColumnAriaLabel: "Pin column",
	unpinColumnAriaLabel: "Unpin column",
	exportCurrentPage: "Current page (CSV)",
	exportCurrentPageDescription: "Exports only the rows visible on this page",
	loadingTableAriaLabel: "Loading table data",
	sortedAscending: "sorted ascending",
	sortedDescending: "sorted descending",
	sortHint: "Sorts the rows by this column",
	editCell: "Edit {column}",
	selectNamedRow: "Select {row}",
	filterAll: "All",
	retry: "Try again",
	pageSizeTitle: "Rows per page",
	pageSizeOption: "{count} per page",
	pinNamedColumn: "Pin {column}",
};

/** A column's sort: ascending, descending, or none. */
export type DataTableSortState = "asc" | "desc" | false;

/** How a header press steps the sort: `asc-desc` alternates; `asc-desc-none` returns to the original order third. */
export type DataTableSortCycle = "asc-desc" | "asc-desc-none";

/** The sort a header press moves to from `current`. */
export function nextDataTableSort(current: DataTableSortState, cycle: DataTableSortCycle): DataTableSortState {
	if (current === false) {
		return "asc";
	}
	if (current === "asc") {
		return "desc";
	}
	return cycle === "asc-desc-none" ? false : "asc";
}

/** A finite number written the way a person types one ("12", "-3.5"). */
const NumericTextSchema = z
	.string()
	.trim()
	.regex(/^-?\d+(\.\d+)?$/u);

/**
 * The value an edited cell's `text` stands for, typed like the value it replaces: a number stays a number when the
 * text is one, `true` / `false` stay booleans, and anything else is the text itself.
 */
export function parseEditedDataTableCell(previous: DataTableCellInput, text: string): DataTableCellScalar {
	const scalar = DataTableCellScalarSchema.safeParse(previous);
	const wasNumber = scalar.success && z.number().safeParse(scalar.data).success;
	if (wasNumber && NumericTextSchema.safeParse(text).success) {
		return Number(text);
	}
	if (scalar.success && z.boolean().safeParse(scalar.data).success && (text === "true" || text === "false")) {
		return text === "true";
	}
	return text;
}

/** The rows a page shows, one-based, for "Showing {from} to {to} of {total}"; `from` is 0 when there are none. */
export interface DataTablePageRange {
	readonly from: number;
	readonly to: number;
}

export function dataTablePageRangeOf(pageIndex: number, pageSize: number, total: number): DataTablePageRange {
	if (total === 0) {
		return { from: 0, to: 0 };
	}
	const from = pageIndex * pageSize + 1;
	return { from: Math.min(from, total), to: Math.min(from + pageSize - 1, total) };
}

/** What an export hands on: a file's name, its media type and its text. */
export interface DataTableExportFile {
	readonly format: DataTableExportFormat;
	readonly filename: string;
	readonly mimeType: string;
	readonly text: string;
}

/** Hands an export on (shares the file, saves it): the app supplies one, since that needs the platform's modules. */
export type DataTableExporter = (file: DataTableExportFile) => Promise<void>;

const EXPORT_EXTENSIONS: Readonly<Record<DataTableExportFormat, string>> = { csv: "csv", json: "json", xlsx: "xls", pdf: "html" };
const EXPORT_MIME_TYPES: Readonly<Record<DataTableExportFormat, string>> = { csv: "text/csv", json: "application/json", xlsx: "application/vnd.ms-excel", pdf: "text/html" };

/**
 * The file for `rows` in `format`, named `basename` with the format's extension. `pdf` is a print-ready HTML
 * document: the app's exporter prints it (a phone has no browser print dialog to hand it to).
 */
export function dataTableExportFileOf(format: DataTableExportFormat, rows: readonly object[], columnIds: readonly string[], basename: string): DataTableExportFile {
	const filename = `${sanitizeExportFilename(basename)}.${EXPORT_EXTENSIONS[format]}`;
	const mimeType = EXPORT_MIME_TYPES[format];
	switch (format) {
		case "csv": {
			return { format, filename, mimeType, text: buildCsvText(rows, columnIds) };
		}
		case "json": {
			return { format, filename, mimeType, text: buildJsonText(rows, columnIds) };
		}
		case "xlsx": {
			return { format, filename, mimeType, text: buildSpreadsheetXml(rows, columnIds) };
		}
		case "pdf": {
			return { format, filename, mimeType, text: buildPrintHtml(rows, columnIds, basename) };
		}
	}
}
