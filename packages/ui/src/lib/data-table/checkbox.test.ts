import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { resolveDataTableCheckboxConfig } from "@workspace/ui/lib/data-table/checkbox";
import type { DataTableLabels } from "@workspace/ui/lib/data-table/labels";

const labels: DataTableLabels = {
	actionsMenuTitle: "Actions",
	openRowMenu: "Open row menu",
	actionsColumnHeader: "Actions",
	searchPlaceholder: "Search",
	searchAriaLabel: "Search rows",
	clearSearchAriaLabel: "Clear search",
	noDataTitle: "No data",
	noDataDescription: "No data",
	noResultsTitle: "No results",
	noResultsDescription: "No results",
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
	showingPageCount: "Showing {count} results",
	pageOfTotal: "Page {page} of {totalPages}",
	showPerPage: "Show",
	perPage: "per page",
	firstPageAriaLabel: "First page",
	previousPageAriaLabel: "Previous page",
	nextPageAriaLabel: "Next page",
	lastPageAriaLabel: "Last page",
	goToPageAriaLabel: "Go to page {page}",
	pinColumnAriaLabel: "Pin column",
	unpinColumnAriaLabel: "Unpin column",
	exportCurrentPage: "Current page (CSV)",
	exportCurrentPageDescription: "Exports only the rows visible on this page",
	loadingTableAriaLabel: "Loading table data",
};

interface DemoRow {
	id: number;
	name: string;
}

describe("resolveDataTableCheckboxConfig", () => {
	it("disables selection, bulk actions and export when checkbox is undefined", () => {
		const resolved = resolveDataTableCheckboxConfig<DemoRow>({
			checkbox: undefined,
			labels,
			deleteSelectedIcon: null,
		});

		expect(resolved.enableBulkSelection).toBe(false);
		expect(resolved.bulkActions).toHaveLength(0);
		expect(resolved.exportable).toBe(false);
		expect(resolved.exportFormats).toEqual([]);
		expect(resolved.exportFilename).toBeUndefined();
	});

	it("enables selection without bulk actions or export when checkbox is true", () => {
		const resolved = resolveDataTableCheckboxConfig<DemoRow>({
			checkbox: true,
			labels,
			deleteSelectedIcon: null,
		});

		expect(resolved.enableBulkSelection).toBe(true);
		expect(resolved.bulkActions).toHaveLength(0);
		expect(resolved.exportable).toBe(false);
		expect(resolved.exportFormats).toEqual([]);
	});

	it("adds delete action and export formats from checkbox config", () => {
		const resolved = resolveDataTableCheckboxConfig<DemoRow>({
			checkbox: {
				onDeleteAll: (): void => undefined,
				export: ["csv", "json"],
				exportFilename: "rows.csv",
			},
			labels,
			deleteSelectedIcon: null,
		});

		expect(resolved.enableBulkSelection).toBe(true);
		expect(resolved.bulkActions).toHaveLength(1);
		expect(resolved.bulkActions[LIST_SLOT_INDEX.first]?.key).toBe("delete-selected");
		expect(resolved.bulkActions[LIST_SLOT_INDEX.first]?.label).toBe("Delete selected");
		expect(resolved.exportable).toBe(true);
		expect(resolved.exportFormats).toEqual(["csv", "json"]);
		expect(resolved.exportFilename).toBe("rows.csv");
	});

	it("appends custom bulk actions after delete and enables every format for export: true", () => {
		const resolved = resolveDataTableCheckboxConfig<DemoRow>({
			checkbox: {
				onDeleteAll: (): void => undefined,
				bulkActions: [{ key: "custom", label: "Custom", onClick: (): void => undefined }],
				export: true,
				exportableColumns: ["name"],
			},
			labels,
			deleteSelectedIcon: null,
		});

		expect(resolved.bulkActions.map((action) => action.key)).toEqual(["delete-selected", "custom"]);
		expect(resolved.exportable).toBe(true);
		expect(resolved.exportFormats).toEqual(["csv", "json", "pdf", "xlsx"]);
		expect(resolved.exportableColumns).toEqual(["name"]);
	});

	it("disables selection when checkbox is false", () => {
		const resolved = resolveDataTableCheckboxConfig<DemoRow>({
			checkbox: false,
			labels,
			deleteSelectedIcon: null,
		});

		expect(resolved.enableBulkSelection).toBe(false);
		expect(resolved.exportable).toBe(false);
	});
});
