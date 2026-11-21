"use client";

import * as React from "react";

import { isArrayValue, isStringPrimitive } from "@workspace/shared";
import {
	createDataTableQuery,
	DataTable,
	type DataTableFilter,
	type DataTablePaging,
	type DataTableQuery,
	type DataTableSearch,
	type DataTableServerSource,
} from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, STATUS_FILTER, TYPE_FILTER, type DocumentSection } from "./data-table-sample";

type SectionComparer = (first: DocumentSection, second: DocumentSection) => number;

/** How the pretend server orders each sortable column, by column id. */
const COMPARERS: Readonly<Record<string, SectionComparer>> = {
	header: (first, second) => first.header.localeCompare(second.header),
	type: (first, second) => first.type.localeCompare(second.type),
	status: (first, second) => first.status.localeCompare(second.status),
	target: (first, second) => first.target - second.target,
	limit: (first, second) => first.limit - second.limit,
	reviewer: (first, second) => first.reviewer.localeCompare(second.reviewer),
};

const SAME_ORDER = 0;

function matchesQuery(section: DocumentSection, query: DataTableQuery): boolean {
	const { status, type } = query.filters;
	if (isStringPrimitive(status) && section.status !== status) {
		return false;
	}
	if (isArrayValue(type) && type.length > 0 && !type.includes(section.type)) {
		return false;
	}
	const search = query.search.trim().toLowerCase();
	return search === "" || section.header.toLowerCase().includes(search) || section.reviewer.toLowerCase().includes(search);
}

function compareBySorting(first: DocumentSection, second: DocumentSection, query: DataTableQuery): number {
	for (const sort of query.sorting) {
		const order = COMPARERS[sort.id]?.(first, second) ?? SAME_ORDER;
		if (order !== SAME_ORDER) {
			return sort.desc ? -order : order;
		}
	}
	return SAME_ORDER;
}

export interface SectionsPage {
	readonly rows: readonly DocumentSection[];
	/** How many sections match the query across every page. */
	readonly totalCount: number;
}

/** What a list endpoint does with a query: filter, sort, then cut out one page and report the matching total. */
export function answerSectionsQuery(query: DataTableQuery): SectionsPage {
	// `filter` hands back an array of its own, so sorting it leaves the sample untouched.
	const matching = DOCUMENT_SECTIONS.filter((section) => matchesQuery(section, query)).sort((first, second) => compareBySorting(first, second, query));
	const start = query.pageIndex * query.pageSize;
	return { rows: matching.slice(start, start + query.pageSize), totalCount: matching.length };
}

const PAGE_SIZE = 5;
/** The page size itself is part of the query; `paging` only lists the sizes offered. */
const PAGING: DataTablePaging = { pageSizeOptions: [PAGE_SIZE, 10, 20] };
const SEARCH: DataTableSearch<DocumentSection> = { keys: ["header", "reviewer"] };
const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER, TYPE_FILTER];

/**
 * A server table holds one page. The page, page size, sort, filters and search live in ONE `query` object the parent
 * owns: the table reports every change through `onQueryChange` and the parent fetches again. A real page keeps the
 * query in the URL and hands it to its data hook; here a function answers in place of the server.
 */
export function DataTable18Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<DataTableQuery>(() => createDataTableQuery(PAGE_SIZE));
	const page = React.useMemo((): SectionsPage => answerSectionsQuery(query), [query]);

	const source = React.useMemo(
		(): DataTableServerSource<DocumentSection> => ({ mode: "server", totalCount: page.totalCount, query, onQueryChange: setQuery }),
		[page.totalCount, query],
	);

	return <DataTable data={page.rows} columns={SECTION_COLUMNS} getRowId={getSectionId} source={source} search={SEARCH} filters={FILTERS} paging={PAGING} />;
}
