import type { DataTableLabels } from "@workspace/ui/components/display/data-table";

export type { DataTableLabels };
export const ADMIN_DATA_TABLE_LABELS: DataTableLabels = {
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
	firstPageAriaLabel: "Go to first page",
	previousPageAriaLabel: "Go to previous page",
	nextPageAriaLabel: "Go to next page",
	lastPageAriaLabel: "Go to last page",
};

/** Merge admin defaults with surface-specific overrides (e.g. custom actions menu title). */
export function createDataTableLabels(overrides: Partial<DataTableLabels> = {}): DataTableLabels {
	return { ...ADMIN_DATA_TABLE_LABELS, ...overrides };
}
