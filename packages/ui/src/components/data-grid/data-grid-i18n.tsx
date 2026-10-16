/**
 * Every user-facing string the data grid renders or announces — the `dataGrid`
 * family of `UiKitLabels`. The kit ships no copy of its own: an app supplies the
 * family through `UiKitLabelsProvider` (the English pack lives in
 * `lib/labels/en.ts`), and one grid overrides individual strings with its
 * `labels` prop (`<DataGrid labels={GRID_LABELS}>`, a module constant).
 *
 * Anything interpolated is a function, so pluralization and word order live in
 * the label, never in string concatenation at a call site.
 *
 * Precedence, most specific wins: a component-level copy prop
 * (`rowCreateLabel`, `loadingMessage`, `emptyMessage`, the pagination label
 * props) beats the grid's `labels` override, which beats the provider's pack.
 */
export interface DataGridLabels {
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
	readonly paginationInfo: (info: DataGridPaginationInfo) => string;
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
export interface DataGridPaginationInfo {
	readonly from: number;
	readonly to: number;
	readonly count: number;
}

/** A per-grid override of some of the family's strings. */
export type DataGridLabelsOverride = Partial<DataGridLabels>;
