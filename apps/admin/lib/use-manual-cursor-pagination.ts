"use client";

import * as React from "react";

import type { DataTableServerPagination } from "@workspace/ui/lib/data-table-pagination";

/** List query params for hybrid cursor + page navigation. */
export interface HybridListQuery {
	readonly page: number;
	readonly limit: number;
	readonly cursor?: string;
}

export interface ManualHybridPaginationState<TData extends object> {
	readonly pageIndex: number;
	readonly page: number;
	readonly pageSize: number;
	readonly listQuery: HybridListQuery;
	readonly paginationResetKey: string;
	readonly handlePaginationChange: (pageIndex: number, pageSize: number) => void;
	readonly bindListMeta: (nextCursor: string | null) => void;
	readonly pagination: DataTableServerPagination<TData>;
}

interface HybridPageState {
	readonly pageIndex: number;
	readonly cursor: string | undefined;
	readonly resetKey: string;
}

const MAX_CURSOR_HISTORY_PAGES = 200;

function buildPaginationResetKey(resetDependencies: React.DependencyList): string {
	return resetDependencies.map((dependency) => JSON.stringify(dependency)).join("|");
}

/**
 * Hybrid server pagination for admin DataTables.
 *
 * - Sequential next/prev uses `cursor` when the API provides one.
 * - Arbitrary page jumps use `page` offset.
 * - Pair with `pagination` on DataTable for totals and "Page X of Y".
 */
export function useManualHybridPagination<TData extends object>(
	initialPageSize: number,
	resetDependencies: React.DependencyList,
	getRowId: (row: TData) => string,
	options?: {
		readonly totalCount?: number;
		readonly onFetchAllMatching?: () => Promise<TData[]>;
		readonly onClearFilters?: () => void;
		readonly isFiltered?: boolean;
	},
): ManualHybridPaginationState<TData> {
	const [pageState, setPageState] = React.useState<HybridPageState>({ pageIndex: 0, cursor: undefined, resetKey: "" });
	const [pageSize, setPageSize] = React.useState(initialPageSize);
	const paginationResetKey = React.useMemo(() => buildPaginationResetKey(resetDependencies), [resetDependencies]);
	const cursorForPageRef = React.useRef<Map<number, string>>(new Map());
	const latestNextCursorRef = React.useRef<string | null>(null);

	const pageIndex = pageState.resetKey === paginationResetKey ? pageState.pageIndex : 0;
	const requestCursor = pageState.resetKey === paginationResetKey ? pageState.cursor : undefined;

	React.useEffect((): void => {
		cursorForPageRef.current = new Map();
		latestNextCursorRef.current = null;
		setPageState({ pageIndex: 0, cursor: undefined, resetKey: paginationResetKey });
	}, [paginationResetKey]);

	const bindListMeta = React.useCallback(
		(nextCursor: string | null): void => {
			latestNextCursorRef.current = nextCursor;
			if (nextCursor !== null) {
				const nextMap = new Map(cursorForPageRef.current);
				nextMap.set(pageIndex + 1, nextCursor);
				if (nextMap.size > MAX_CURSOR_HISTORY_PAGES) {
					const firstKey = nextMap.keys().next().value;
					if (firstKey !== undefined) {
						nextMap.delete(firstKey);
					}
				}
				cursorForPageRef.current = nextMap;
			}
		},
		[pageIndex],
	);

	const resolveRequestCursor = React.useCallback((targetPageIndex: number, currentPageIndex: number): string | undefined => {
		if (targetPageIndex === 0) {
			return undefined;
		}
		if (targetPageIndex === currentPageIndex + 1) {
			const sequentialCursor = cursorForPageRef.current.get(targetPageIndex) ?? latestNextCursorRef.current;
			return sequentialCursor ?? undefined;
		}
		if (targetPageIndex === currentPageIndex - 1) {
			return cursorForPageRef.current.get(targetPageIndex);
		}
		return undefined;
	}, []);

	const handlePaginationChange = React.useCallback(
		(nextPageIndex: number, nextPageSize: number): void => {
			if (nextPageSize !== pageSize) {
				setPageSize(nextPageSize);
				cursorForPageRef.current = new Map();
				latestNextCursorRef.current = null;
				setPageState({ pageIndex: 0, cursor: undefined, resetKey: paginationResetKey });
				return;
			}

			const targetPageIndex = Math.max(0, nextPageIndex);
			const nextCursor = resolveRequestCursor(targetPageIndex, pageIndex);
			setPageState({ pageIndex: targetPageIndex, cursor: nextCursor, resetKey: paginationResetKey });
		},
		[pageIndex, pageSize, paginationResetKey, resolveRequestCursor],
	);

	const listQuery = React.useMemo((): HybridListQuery => {
		const base: HybridListQuery = { page: pageIndex + 1, limit: pageSize };
		if (requestCursor !== undefined) {
			return { ...base, cursor: requestCursor };
		}
		return base;
	}, [pageIndex, pageSize, requestCursor]);

	const pagination = React.useMemo(
		(): DataTableServerPagination<TData> => ({
			mode: "server",
			totalCount: options?.totalCount ?? 0,
			pageIndex,
			pageSize,
			onPageChange: handlePaginationChange,
			resetKey: paginationResetKey,
			getRowId,
			...(options?.onFetchAllMatching !== undefined ? { onFetchAllMatching: options.onFetchAllMatching } : {}),
			...(options?.onClearFilters !== undefined ? { onClearFilters: options.onClearFilters } : {}),
			...(options?.isFiltered !== undefined ? { isFiltered: options.isFiltered } : {}),
		}),
		[pageIndex, pageSize, handlePaginationChange, paginationResetKey, getRowId, options?.totalCount, options?.onFetchAllMatching, options?.onClearFilters, options?.isFiltered],
	);

	return {
		pageIndex,
		page: pageIndex + 1,
		pageSize,
		listQuery,
		paginationResetKey,
		handlePaginationChange,
		bindListMeta,
		pagination,
	};
}

/** @deprecated Use {@link useManualHybridPagination}. */
export function useManualListPagination<TData extends object>(
	initialPageSize: number,
	resetDependencies: React.DependencyList,
	getRowId: (row: TData) => string,
): ManualHybridPaginationState<TData> {
	return useManualHybridPagination(initialPageSize, resetDependencies, getRowId);
}

/** @deprecated Use {@link useManualHybridPagination}. */
export const useManualCursorPagination = useManualHybridPagination;

export type ManualListPaginationState<TData extends object> = ManualHybridPaginationState<TData>;
export type ManualCursorPaginationState<TData extends object> = ManualHybridPaginationState<TData>;
