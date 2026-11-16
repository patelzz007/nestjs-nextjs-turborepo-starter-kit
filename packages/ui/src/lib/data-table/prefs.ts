// DataTable preferences and cell values: shared with the native kit (@workspace/ui-kit-logic), re-exported for the web
// kit's consumers.

export {
	DataTableCellScalarSchema,
	DataTableCellValueSchema,
	DataTablePersistedPrefsSchema,
	DataTableStructuredCellSchema,
	displayStringFromTanStackValue,
	normalizeFacetedUniqueValues,
	parseDataTableCellValue,
	parseDataTablePersistedPrefs,
	parseDataTablePrefsPatch,
	readDataTableRowField,
	reconcileDataTablePrefs,
	toDataTableCellString,
	type DataTableCellInput,
	type DataTableCellScalar,
	type DataTableCellValue,
	type DataTablePersistedPrefs,
	type DataTablePersistedPrefsPatch,
	type DataTableStructuredCell,
	type ReconcileDataTablePrefsInput,
	type ReconciledDataTablePrefs,
} from "@workspace/ui-kit-logic";
