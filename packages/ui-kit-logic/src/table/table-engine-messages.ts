// The data grid's copy, shared by the web and native kits: every string the grid renders or announces, the English
// messages (the same as the web's `en.json` `tableEngine` family, which a web test checks), and the builder that turns
// one language's messages into labels (functions where a message has placeholders). The web builds every language's
// pack from its catalogues; the native kit builds English and takes overrides.

import type { MessageValues } from "@workspace/shared";

/** Every user-facing string the data grid renders or announces. Anything interpolated is a function, so plurals and word
 * order live in the label, never in string concatenation at a call site. */
export interface TableEngineLabels {
	/** Column header menu: sort ascending. */
	readonly sortAscending: string;
	/** Column header menu: sort descending. */
	readonly sortDescending: string;
	/** Column header menu: pin to the start edge. */
	readonly pinColumnStart: string;
	/** Column header menu: pin to the end edge. */
	readonly pinColumnEnd: string;
	/** Column header menu: move one slot towards the start. */
	readonly moveColumnStart: string;
	/** Column header menu: move one slot towards the end. */
	readonly moveColumnEnd: string;
	/** Column header menu: the column-visibility submenu. */
	readonly columnsMenu: string;
	/** Accessible name of a pinned header's unpin button, e.g. `Unpin Email column`. */
	readonly unpinColumn: (title: string) => string;
	/** Heading of the column-visibility menu. */
	readonly toggleColumns: string;
	/** The quick-create row's button. */
	readonly rowCreate: string;
	/** The focused cell's A1 address above a spreadsheet with A1 headers. */
	readonly cellAddress: string;
	/** Row pin toggle, unpinned state. */
	readonly pinRow: string;
	/** Row pin toggle, pinned state. */
	readonly unpinRow: string;
	/** Row selection checkbox. */
	readonly selectRow: string;
	/** Header select-all checkbox. */
	readonly selectAll: string;
	/** Row expansion toggle, collapsed state. */
	readonly expandRow: string;
	/** Row expansion toggle, expanded state. */
	readonly collapseRow: string;
	/** Column drag handle. */
	readonly dragToReorder: string;
	/** Row drag handle. */
	readonly dragToReorderRow: string;
	/** Row drag handle while reordering is disabled (sorted/filtered views). */
	readonly reorderingUnavailable: string;
	/** Loading message. */
	readonly loading: string;
	/** Empty-state message. */
	readonly empty: string;
	/** Infinite-scroll footer once every row is loaded. */
	readonly allRowsLoaded: string;
	/** Infinite-scroll footer while the next page loads. */
	readonly fetchingMore: string;
	/** Pagination: the page-size select's label. */
	readonly rowsPerPage: string;
	/** Pagination: `1 - 10 of 42`. */
	readonly paginationInfo: (info: TableEnginePaginationInfo) => string;
	/** Pagination: previous-page button. */
	readonly previousPage: string;
	/** Pagination: next-page button. */
	readonly nextPage: string;
	/** Pagination: a numbered page button, e.g. `Go to page 3`. */
	readonly goToPage: (page: number) => string;
	/** Pagination: the visible text of the collapsed-pages button. */
	readonly paginationEllipsis: string;
	/** Faceted column filter: `3 selected`. */
	readonly filterSelectedCount: (count: number) => string;
	/** Faceted column filter: no option matches the search. */
	readonly filterNoResults: string;
	/** Faceted column filter: clear button. */
	readonly filterClear: string;
	/** Accessible name of a column's resize handle (a button; Arrow keys resize), e.g. `Resize Email column`. */
	readonly resizeColumn: (title: string) => string;
	/** Row selection bar: the selected-row count, e.g. `3 selected`. */
	readonly selectionBarCount: (count: number) => string;
	/** Row selection bar: the clear-selection button. */
	readonly selectionBarClear: string;
}

/** The numbers `paginationInfo` formats: the 1-based first and last row shown, and the total. */
export interface TableEnginePaginationInfo {
	readonly from: number;
	readonly to: number;
	readonly count: number;
}

/** One language's data grid messages: every label as its ICU message. */
export type TableEngineMessages = Readonly<Record<keyof TableEngineLabels, string>>;

export const TABLE_ENGINE_MESSAGES_EN: TableEngineMessages = {
	sortAscending: "Asc",
	sortDescending: "Desc",
	pinColumnStart: "Pin to left",
	pinColumnEnd: "Pin to right",
	moveColumnStart: "Move to left",
	moveColumnEnd: "Move to right",
	columnsMenu: "Columns",
	unpinColumn: "Unpin {title} column",
	toggleColumns: "Toggle columns",
	rowCreate: "Add row",
	cellAddress: "Cell",
	pinRow: "Pin row",
	unpinRow: "Unpin row",
	selectRow: "Select row",
	selectAll: "Select all",
	expandRow: "Expand row",
	collapseRow: "Collapse row",
	dragToReorder: "Drag to reorder",
	dragToReorderRow: "Drag to reorder row",
	reorderingUnavailable: "Reordering unavailable",
	loading: "Loading…",
	empty: "No data available",
	allRowsLoaded: "All records loaded",
	fetchingMore: "Loading more…",
	rowsPerPage: "Rows per page",
	paginationInfo: "{from} - {to} of {count}",
	previousPage: "Go to previous page",
	nextPage: "Go to next page",
	goToPage: "Go to page {page}",
	paginationEllipsis: "…",
	filterSelectedCount: "{count} selected",
	filterNoResults: "No results found.",
	filterClear: "Clear filters",
	resizeColumn: "Resize {title} column",
	selectionBarCount: "{count} selected",
	selectionBarClear: "Clear",
};

/** Fills one message's `{placeholders}` for the language at hand. */
export type TableEngineMessageFormatter = (message: string, values: MessageValues) => string;

/** The grid's labels from one language's messages: plain strings as they are, the rest as functions of their values. */
export function buildTableEngineLabels(m: TableEngineMessages, t: TableEngineMessageFormatter): TableEngineLabels {
	return {
		...m,
		unpinColumn: (title: string): string => t(m.unpinColumn, { title }),
		paginationInfo: ({ from, to, count }: TableEnginePaginationInfo): string => t(m.paginationInfo, { from, to, count }),
		goToPage: (page: number): string => t(m.goToPage, { page }),
		filterSelectedCount: (count: number): string => t(m.filterSelectedCount, { count }),
		resizeColumn: (title: string): string => t(m.resizeColumn, { title }),
		selectionBarCount: (count: number): string => t(m.selectionBarCount, { count }),
	};
}
