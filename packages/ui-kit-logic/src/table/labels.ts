// DataTable copy, shared by the web and native kits: every word a table shows or says, with `{key}` placeholders.

/** User-visible copy for DataTable affordances — the `dataTable` family of `UiKitLabels`. */
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
	/** Destructive bulk action when `checkbox.onDeleteAll` is set. */
	readonly deleteSelected: string;
	/** Mobile selection bar label when no rows are selected yet. */
	readonly mobileSelectAll: string;
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
	/** e.g. `Showing {count} results` — used for cursor-paginated server tables without a total. */
	readonly showingPageCount: string;
	/** e.g. `Page {page} of {totalPages}` */
	readonly pageOfTotal: string;
	readonly firstPageAriaLabel: string;
	readonly previousPageAriaLabel: string;
	readonly nextPageAriaLabel: string;
	readonly lastPageAriaLabel: string;
	/** e.g. `Go to page {page}` */
	readonly goToPageAriaLabel: string;
	readonly pinColumnAriaLabel: string;
	readonly unpinColumnAriaLabel: string;
	/** Shown when server export falls back to the current page only. */
	readonly exportCurrentPage: string;
	readonly exportCurrentPageDescription: string;
	readonly loadingTableAriaLabel: string;
	/** A select filter's "no filter" choice. */
	readonly filterAll: string;
	/** A filter choice with how many rows have it, e.g. `{label} ({count})`. */
	readonly filterOptionCount: string;
	/** The button that runs a failed load again. */
	readonly retry: string;
	/** The toolbar control that sets how much room each row takes, and its three choices. */
	readonly densityToggle: string;
	readonly densityCompact: string;
	readonly densityComfortable: string;
	readonly densitySpacious: string;
	/** The button inside a date-range filter that removes its range. */
	readonly clearDateRange: string;
	/** Announced while a row action runs, e.g. `Archiving…` from `{label}…`. */
	readonly rowActionPending: string;
	/** The retry button of a row action that failed, e.g. `Archive failed. Try again` from `{label} failed. Try again`. */
	readonly rowActionFailed: string;
	/** The export dialog (`exporting.mode: "dialog"`): its title, its three sections and its buttons. */
	readonly exportDialogTitle: string;
	readonly exportDialogFormat: string;
	readonly exportDialogRows: string;
	readonly exportDialogColumns: string;
	/** e.g. `Ticked rows ({count})` */
	readonly exportScopeSelected: string;
	/** e.g. `Rows that match ({count})` */
	readonly exportScopeMatching: string;
	/** e.g. `Every row ({count})` */
	readonly exportScopeAll: string;
	/** e.g. `Export {count} rows` */
	readonly exportDialogConfirm: string;
	readonly exportDialogCancel: string;
	/** The toolbar's undo and redo buttons (`editing.history`). */
	readonly editUndo: string;
	readonly editRedo: string;
	/** Announced when a save fails and the old value goes back, e.g. `Could not save {column}. The old value is back.` */
	readonly cellEditFailed: string;
	/** The detail panel (`detail.mode: "panel"`): its name when the row has no title, and its buttons. */
	readonly detailPanelLabel: string;
	readonly detailPanelClose: string;
	readonly detailPanelPrevious: string;
	readonly detailPanelNext: string;
}

/** Replaces `{key}` placeholders in a label template. */
export function formatDataTableLabel(template: string, values: Readonly<Record<string, string | number>>): string {
	let result = template;
	for (const [key, value] of Object.entries(values)) {
		result = result.replaceAll(`{${key}}`, String(value));
	}
	return result;
}
