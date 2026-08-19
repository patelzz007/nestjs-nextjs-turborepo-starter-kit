/** User-visible copy for DataTable affordances (rule 11 — parent supplies all strings). */
export interface DataTableLabels {
	readonly actionsMenuTitle: string;
	readonly openRowMenu: string;
	readonly actionsColumnHeader: string;
	readonly searchPlaceholder: string;
	readonly searchAriaLabel: string;
	readonly clearSearchAriaLabel: string;
	readonly noDataTitle: string;
	readonly noDataDescription: string;
	readonly noResultsTitle: string;
	readonly noResultsDescription: string;
	readonly clearFilters: string;
	readonly selectAllAriaLabel: string;
	readonly selectRowAriaLabel: string;
	/** e.g. `All {pageCount} rows on this page are selected.` */
	readonly selectAllPageRowsSelected: string;
	/** e.g. `Select all {totalCount} rows` */
	readonly selectAllFilteredRows: string;
	/** e.g. `1 row selected` (singular) */
	readonly selectedRowCount: string;
	/** e.g. `{count} rows selected` */
	readonly selectedRowsCount: string;
	/** e.g. `All {totalCount} rows selected` */
	readonly allRowsSelected: string;
	readonly clearSelection: string;
	readonly export: string;
	readonly exportAs: string;
	readonly exportCsv: string;
	readonly exportCsvDescription: string;
	readonly exportJson: string;
	readonly exportJsonDescription: string;
	readonly exportPdf: string;
	readonly exportPdfDescription: string;
	readonly exportSpreadsheet: string;
	readonly exportSpreadsheetDescription: string;
	readonly columnsToggle: string;
	/** e.g. `{filtered} of {total} results` */
	readonly resultsCount: string;
	/** e.g. `Showing {from} to {to} of {total} results` */
	readonly showingResults: string;
	readonly showPerPage: string;
	readonly perPage: string;
	readonly firstPageAriaLabel: string;
	readonly previousPageAriaLabel: string;
	readonly nextPageAriaLabel: string;
	readonly lastPageAriaLabel: string;
}

/** Replaces `{key}` placeholders in a label template. */
export function formatDataTableLabel(template: string, values: Readonly<Record<string, string | number>>): string {
	let result = template;
	for (const [key, value] of Object.entries(values)) {
		result = result.replaceAll(`{${key}}`, String(value));
	}
	return result;
}
