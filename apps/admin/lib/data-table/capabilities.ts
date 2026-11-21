import type { RowData } from "@tanstack/react-table";
import type {
	DataTableBulkAction,
	DataTableBulkSelectionContext,
	DataTableColumnControls,
	DataTableExporting,
	DataTablePaging,
	DataTableRowKey,
	DataTableSelection,
	DataTableStatus,
} from "@workspace/ui/components/data-table";

/** A client-side table that pages its rows with the table's defaults (10 a page). */
export const TABLE_DEFAULT_PAGING: DataTablePaging = {};

/** The table's status for a query: skeleton rows on the first load, dimmed rows on a background refetch. */
export function toTableStatus(query: { readonly isLoading: boolean; readonly isFetching?: boolean }, error?: string | null): DataTableStatus {
	const loading = query.isLoading ? "initial" : query.isFetching === true ? "refreshing" : false;
	return error === undefined || error === null ? { loading } : { loading, error };
}

/** What every admin table lets its reader change about the columns: show and hide them. */
export const TABLE_COLUMN_CONTROLS: DataTableColumnControls = { visibility: true };

/** A table's row checkboxes with their bulk actions, and its export menu. Spread the two onto `DataTable`. */
export interface TableBulk<TData extends RowData> {
	readonly selection: DataTableSelection<TData>;
	readonly exporting: DataTableExporting<TData>;
}

export interface ResourceTableBulkOptions<TData extends RowData> {
	/**
	 * `useAbility().can("DELETE", "<RESOURCE>")` — the container decides;
	 * bulk delete is offered only when true.
	 */
	readonly canDelete: boolean;
	readonly exportFilename: string;
	/** The row fields the export writes, in order: any field of the row, shown as a column or not. Every column when left out. */
	readonly exportKeys?: readonly DataTableRowKey<TData>[];
	readonly onDelete?: (rows: TData[], context: DataTableBulkSelectionContext) => void | Promise<void>;
	/** Already filtered by the caller to the actions the session may run. */
	readonly bulkActions?: readonly DataTableBulkAction<TData>[];
}

/** Checkboxes + multi-format export; bulk delete only when the session may delete. */
export function buildResourceTableBulk<TData extends RowData>(options: ResourceTableBulkOptions<TData>): TableBulk<TData> {
	const includeDelete = options.onDelete !== undefined && options.canDelete;

	return {
		selection: {
			...(options.bulkActions !== undefined && options.bulkActions.length > 0 ? { bulkActions: options.bulkActions } : {}),
			...(includeDelete ? { onDelete: options.onDelete } : {}),
		},
		exporting: toExporting(options.exportFilename, options.exportKeys),
	};
}

/**
 * Row checkboxes with no bulk action, and the export menu. The selection names no row type, so it fits a table of any
 * rows; the export is typed by the table's rows, so its keys are checked against them.
 */
export interface ReadOnlyTableBulk<TData extends RowData> {
	readonly selection: Pick<DataTableSelection<RowData>, "scope" | "onScopeChange">;
	readonly exporting: DataTableExporting<TData>;
}

/** Checkboxes + export for read-only audit tables (no bulk delete). `exportKeys`: the row fields written, in order. */
export function buildReadOnlyTableBulk<TData extends RowData>(exportFilename: string, exportKeys?: readonly DataTableRowKey<TData>[]): ReadOnlyTableBulk<TData> {
	return { selection: {}, exporting: toExporting(exportFilename, exportKeys) };
}

function toExporting<TData extends RowData>(filename: string, keys: readonly DataTableRowKey<TData>[] | undefined): DataTableExporting<TData> {
	return { filename, ...(keys === undefined ? {} : { keys }) };
}
