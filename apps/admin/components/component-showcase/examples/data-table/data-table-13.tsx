"use client";

import type { SortingState } from "@tanstack/react-table";
import * as React from "react";

import { DataTable, type DataTableServerPagination, type Filter } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, STATUS_FILTER, type DocumentSection } from "./data-table-sample";

const PAGE_SIZE = 5;
/** How long the pretend server takes to answer. */
const LATENCY_MS = 400;

export interface SectionsQuery {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting: SortingState;
	readonly status: string | null;
}

export interface SectionsPage {
	readonly rows: readonly DocumentSection[];
	readonly totalCount: number;
}

/** How the server compares two rows for each sortable column. */
const COMPARE: Readonly<Record<string, (left: DocumentSection, right: DocumentSection) => number>> = {
	header: (left, right) => left.header.localeCompare(right.header),
	type: (left, right) => left.type.localeCompare(right.type),
	status: (left, right) => left.status.localeCompare(right.status),
	target: (left, right) => Number(left.target) - Number(right.target),
	limit: (left, right) => Number(left.limit) - Number(right.limit),
	reviewer: (left, right) => left.reviewer.localeCompare(right.reviewer),
};

/** What a server would do with the query: filter, sort, then cut out one page. */
export function answerSectionsQuery({ pageIndex, pageSize, sorting, status }: SectionsQuery): SectionsPage {
	const matching = DOCUMENT_SECTIONS.filter((row) => status === null || row.status === status);
	const sort = sorting.at(0);
	const compare = sort === undefined ? undefined : COMPARE[sort.id];
	const sorted = sort === undefined || compare === undefined ? matching : [...matching].sort((left, right) => (sort.desc ? compare(right, left) : compare(left, right)));
	return { rows: sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), totalCount: matching.length };
}

const FILTERS: Filter[] = [STATUS_FILTER];
const INITIAL_QUERY: SectionsQuery = { pageIndex: 0, pageSize: PAGE_SIZE, sorting: [], status: null };

export function DataTable13Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<SectionsQuery>(INITIAL_QUERY);
	const [page, setPage] = React.useState<SectionsPage>(() => answerSectionsQuery(INITIAL_QUERY));
	const [isFetching, setIsFetching] = React.useState(false);

	/** Every change to the query is a request: the current rows stay, dimmed, until it is answered. */
	const request = React.useCallback((change: (current: SectionsQuery) => SectionsQuery): void => {
		setIsFetching(true);
		setQuery(change);
	}, []);

	React.useEffect((): (() => void) => {
		const timer = window.setTimeout((): void => {
			setPage(answerSectionsQuery(query));
			setIsFetching(false);
		}, LATENCY_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [query]);

	const pagination = React.useMemo(
		(): DataTableServerPagination<DocumentSection> => ({
			mode: "server",
			totalCount: page.totalCount,
			pageIndex: query.pageIndex,
			pageSize: query.pageSize,
			onPageChange: (pageIndex: number, pageSize: number): void => {
				request((current) => ({ ...current, pageIndex, pageSize }));
			},
			getRowId: (row: DocumentSection): string => String(row.id),
		}),
		[page.totalCount, query.pageIndex, query.pageSize, request],
	);
	const handleSortingChange = React.useCallback(
		(sorting: SortingState): void => {
			request((current) => ({ ...current, sorting, pageIndex: 0 }));
		},
		[request],
	);
	const handleFilterChange = React.useCallback(
		(_key: string, value: string | null): void => {
			request((current) => ({ ...current, status: value, pageIndex: 0 }));
		},
		[request],
	);
	const columnFilters = React.useMemo((): Readonly<Record<string, string>> => (query.status === null ? {} : { status: query.status }), [query.status]);

	return (
		<DataTable
			data={page.rows}
			columns={SECTION_COLUMNS}
			pagination={pagination}
			sorting={query.sorting}
			onManualSortingChange={handleSortingChange}
			filters={FILTERS}
			manualColumnFilters={columnFilters}
			onManualColumnFilterChange={handleFilterChange}
			isRefetching={isFetching}
			title="Server mode"
			description="The parent owns paging, sorting and filtering and fetches each page; the table reports what the reader asked for."
		/>
	);
}
