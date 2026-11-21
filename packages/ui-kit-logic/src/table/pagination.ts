// DataTable pagination modes, shared by the web and native kits: the table pages its rows itself (client), or the
// parent fetches each page and owns the total (server).

/**
 * A row's id, read off the row. Checked bivariantly (a method's parameter), so a table generic over its rows keeps
 * the row type through a wrapper that erases it (`React.memo`).
 */
export type DataTableRowIdReader<TData> = { bivarianceHack(row: TData): string }["bivarianceHack"];

/** Client-side pagination — TanStack slices and pages the full dataset locally. */
export interface DataTableClientPagination<TData> {
	readonly mode: "client";
	readonly defaultPageSize?: number;
	readonly getRowId?: DataTableRowIdReader<TData>;
}

/** Server-side pagination — parent owns the row set and total count. */
export interface DataTableServerPagination<TData> {
	readonly mode: "server";
	readonly totalCount: number;
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly onPageChange: (pageIndex: number, pageSize: number) => void;
	readonly resetKey?: string;
	/** Required: bulk actions and exports must address records, not row indices. */
	readonly getRowId: DataTableRowIdReader<TData>;
	readonly onFetchAllMatching?: () => Promise<TData[]>;
	/** Toolbar owns server search — table delegates "Clear filters" here. */
	readonly onClearFilters?: () => void;
	readonly isFiltered?: boolean;
}

export type DataTablePagination<TData> = DataTableClientPagination<TData> | DataTableServerPagination<TData>;

/** Whether a `pagination` config is server mode. */
export function isServerPagination<TData>(pagination: DataTablePagination<TData> | undefined): pagination is DataTableServerPagination<TData> {
	return pagination?.mode === "server";
}

export function isClientPagination<TData>(pagination: DataTablePagination<TData> | undefined): pagination is DataTableClientPagination<TData> {
	return pagination?.mode === "client" || pagination === undefined;
}
