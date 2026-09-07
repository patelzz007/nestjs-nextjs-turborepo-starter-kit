import type { RowData } from "@tanstack/react-table";

/** Client-side pagination — TanStack slices and pages the full dataset locally. */
export interface DataTableClientPagination<TData extends RowData> {
	readonly mode: "client";
	readonly defaultPageSize?: number;
	readonly getRowId?: (row: TData) => string;
}

/** Server-side pagination — parent owns the row set and total count. */
export interface DataTableServerPagination<TData extends RowData> {
	readonly mode: "server";
	readonly totalCount: number;
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly onPageChange: (pageIndex: number, pageSize: number) => void;
	readonly resetKey?: string;
	/** Required: bulk actions and exports must address records, not row indices. */
	readonly getRowId: (row: TData) => string;
	readonly onFetchAllMatching?: () => Promise<TData[]>;
	/** Toolbar owns server search — table delegates "Clear filters" here. */
	readonly onClearFilters?: () => void;
	readonly isFiltered?: boolean;
}

export type DataTablePagination<TData extends RowData> = DataTableClientPagination<TData> | DataTableServerPagination<TData>;

export function isServerPagination<TData extends RowData>(
	pagination: DataTablePagination<TData> | undefined,
): pagination is DataTableServerPagination<TData> {
	return pagination?.mode === "server";
}

export function isClientPagination<TData extends RowData>(
	pagination: DataTablePagination<TData> | undefined,
): pagination is DataTableClientPagination<TData> {
	return pagination?.mode === "client" || pagination === undefined;
}
