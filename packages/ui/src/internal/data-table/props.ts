// DataTable's public props. One prop per job, named after the job; a feature is off while its prop is absent. Every
// row is addressed by its id (`getRowId`), never by its position. Re-exported by components/data-table.tsx.

import type { CellData, ColumnDef, RowData } from "@tanstack/react-table";
import type {
	DataTableColumnSort,
	DataTableDateZone,
	DataTableDensity,
	DataTableExportFormat,
	DataTableFilterValue,
	DataTableLabels,
	DataTableQuery,
	DataTableQueryChange,
	DataTableRowActionTone,
	DataTableRowMove,
	DataTableStorageAdapter,
	TableEngineLabels,
} from "@workspace/ui-kit-logic";
import type * as React from "react";

import type { TableEngineFeatures, TableEngineRowStatus } from "../table-engine/table-engine";

/** The TanStack feature set every `DataTable` is built on. Type columns as `ColumnDef<DataTableFeatures, Row>`. */
export type DataTableFeatures = TableEngineFeatures;

/** A table's column definitions. Keep the array stable (a module constant or `useMemo`). */
export type DataTableColumns<TData extends RowData> = ColumnDef<DataTableFeatures, TData>[];

// ── Row callbacks ──────────────────────────────────────────────────────────
// Declared through a method signature so a table generic over its rows keeps the row type through a wrapper that
// erases it (`React.memo`): a callback typed for `Invoice` type-checks against the table's row type, with no cast.

/** Reads a row's stable id. */
export type DataTableRowIdReader<TData> = { bivarianceHack(row: TData): string }["bivarianceHack"];

/** Something that happens to one row. */
export type DataTableRowHandler<TData> = { bivarianceHack(row: TData): void | Promise<void> }["bivarianceHack"];

/** Renders something for one row. */
export type DataTableRowRenderer<TData> = { bivarianceHack(row: TData): React.ReactNode }["bivarianceHack"];

/** Reads a row's children, for a tree. */
export type DataTableSubRowsReader<TData> = { bivarianceHack(row: TData): TData[] | undefined }["bivarianceHack"];

/** Reads a row's lifecycle mark. */
export type DataTableRowStatusReader<TData> = { bivarianceHack(row: TData): DataTableRowStatus | undefined }["bivarianceHack"];

/** One field of a row, by its key: what the search box matches and what an export writes, shown as a column or not. */
export type DataTableRowKey<TData> = keyof TData & string;

/** "new" and "dirty" tint a row, "deleted" mutes and strikes it. What they mean stays with the caller. */
export type DataTableRowStatus = TableEngineRowStatus;

// ── 2. Where the rows come from ────────────────────────────────────────────

/** The table holds every row and sorts, filters and pages them itself. The default. */
export interface DataTableClientSource {
	readonly mode: "client";
}

/** The parent fetches each page. `data` is the current page only; the parent owns `query` and refetches when it changes. */
export interface DataTableServerSource<TData> {
	readonly mode: "server";
	/** How many rows match the query on the server, across every page. */
	readonly totalCount: number;
	/** The page, page size, sort, filters and search the current `data` was fetched with. */
	readonly query: DataTableQuery;
	/** Fires with the next query and what changed in it. Write it to your state (the URL) and refetch. */
	readonly onQueryChange: (query: DataTableQuery, change: DataTableQueryChange) => void;
	/** Fetches every matching row, for "select all matching rows" and for exporting more than the page. */
	readonly onFetchAllMatching?: () => Promise<TData[]>;
	/**
	 * Set it when something outside `query` also narrows the rows (a control of your own in `toolbar.extra`). An empty
	 * page then reads "nothing matches, clear the filters" instead of the table's empty state.
	 */
	readonly isFiltered?: boolean;
}

/** The table holds the rows loaded so far and asks for more as the reader nears the end. */
export interface DataTableInfiniteSource {
	readonly mode: "infinite";
	/** `false` once every row is loaded. */
	readonly hasMore: boolean;
	/** `true` while the next batch is loading. */
	readonly isFetchingMore: boolean;
	/** Fires when the reader nears the last loaded row. */
	readonly onLoadMore: () => void;
}

export type DataTableSource<TData> = DataTableClientSource | DataTableServerSource<TData> | DataTableInfiniteSource;

// ── 3. Chrome ──────────────────────────────────────────────────────────────

/** The card header above the table. */
export interface DataTableHeading {
	readonly title?: React.ReactNode;
	readonly description?: React.ReactNode;
	/** Buttons at the end of the header (for example "New invoice"). */
	readonly actions?: React.ReactNode;
}

/** How the toolbar lays out the search and the filters. */
export type DataTableToolbarLayout = "inline" | "fill";

export interface DataTableToolbar {
	/**
	 * `inline` (default): the search is a fixed width and the filters take what is left, wrapping when they do not
	 * fit. `fill`: from `sm` up the search and every filter are equal columns across the whole row, for a table whose
	 * filters are its main controls.
	 */
	readonly layout?: DataTableToolbarLayout;
	/** Your own controls in the toolbar row, before the export and columns buttons. */
	readonly extra?: React.ReactNode;
}

/** One row under the table body, for totals and summaries. */
export interface DataTableFooterRow {
	readonly key: string;
	/** What each column shows in this row, by column id. A column with no entry stays empty. */
	readonly cells: Readonly<Record<string, React.ReactNode>>;
}

export interface DataTableFooter {
	readonly rows: readonly DataTableFooterRow[];
}

// ── 4. Status ──────────────────────────────────────────────────────────────

/** `"initial"` replaces the rows with skeletons; `"refreshing"` keeps them visible, dimmed. */
export type DataTableLoading = false | "initial" | "refreshing";

export interface DataTableStatus {
	readonly loading?: DataTableLoading;
	/** An error message. With no rows it replaces them; over rows already shown it is a banner above them. */
	readonly error?: string | null;
	/** Adds a retry button to the error. */
	readonly onRetry?: () => void;
	/** How many skeleton rows an initial load draws. */
	readonly skeletonRows?: number;
}

/** What to show when the table has no rows at all (not when a filter hides them: that state is built in). */
export interface DataTableEmptyState {
	readonly icon?: React.ReactNode;
	readonly title?: string;
	readonly description?: string;
	readonly action?: {
		readonly label: string;
		readonly onClick: () => void;
	};
}

// ── 5. Finding rows ────────────────────────────────────────────────────────

export interface DataTableSearch<TData> {
	/**
	 * The row fields the search box matches, by key: any field of the row, shown as a column or not (an email shown
	 * under a name). Each is read from the row as it is. A key the row type doesn't have is a type error.
	 */
	readonly keys: readonly DataTableRowKey<TData>[];
	/** How long typing settles before the rows are filtered (or, in server mode, before the query changes). */
	readonly debounceMs?: number;
}

/** One choice of a filter. */
export interface DataTableFilterOption {
	readonly value: string;
	readonly label: string;
	/** A decorative glyph before the label in the open list. */
	readonly icon?: React.ReactNode;
}

interface DataTableFilterBase {
	/** The column this filter narrows (client mode), or the query key it sets (server mode). */
	readonly column: string;
	/** The filter's name, shown in front of its value. */
	readonly label: string;
}

/** Pick one option, or "All". */
export interface DataTableSelectFilter extends DataTableFilterBase {
	readonly kind: "select";
	readonly options: readonly DataTableFilterOption[];
}

/** Pick any number of options from a searchable list. */
export interface DataTableMultiSelectFilter extends DataTableFilterBase {
	readonly kind: "multi-select";
	readonly options: readonly DataTableFilterOption[];
}

/**
 * Pick a range of days from a calendar. The column's cells hold epoch milliseconds, a `Date` or an ISO string. The
 * value is `{ from, to }`, two `yyyy-MM-dd` days, both included; either may be `null` for an open end.
 */
export interface DataTableDateRangeFilter extends DataTableFilterBase {
	readonly kind: "date-range";
	/**
	 * Whose calendar decides which day a cell falls on (client mode). `local` (default): the reader's time zone, for
	 * timestamps. `utc`: for a calendar day stored as its UTC midnight, which must read as the same day everywhere.
	 */
	readonly zone?: DataTableDateZone;
}

export type DataTableFilter = DataTableSelectFilter | DataTableMultiSelectFilter | DataTableDateRangeFilter;

/** How header clicks cycle a column's sort. */
export type DataTableSortCycle = "asc-desc" | "asc-desc-none";

export interface DataTableSortingOptions {
	/** `asc-desc` (default) flips between the two; `asc-desc-none` returns to the original order on the third click. */
	readonly cycle?: DataTableSortCycle;
	/**
	 * The sort a client or infinite table starts with, most significant column first. A saved preference wins over
	 * it. A server table's sort lives in `source.query`.
	 */
	readonly initial?: readonly DataTableColumnSort[];
}

export interface DataTablePaging {
	/** Rows per page to start with. In server mode the page size comes from `source.query`. */
	readonly pageSize?: number;
	/** The page sizes people can pick. */
	readonly pageSizeOptions?: readonly number[];
}

// ── 6. Acting on rows ──────────────────────────────────────────────────────

/** How strongly a bulk action reads. `destructive` is for an action that removes or cannot be undone. */
export type DataTableActionTone = "default" | "destructive";

/** One entry of the ⋯ menu at the end of each row: an icon tile, a title and a subtitle. */
export interface DataTableRowAction<TData> {
	readonly key: string;
	/** The title: what the action is ("Duplicate"). */
	readonly label: string;
	/** The subtitle under the title: what it does ("Copy this section as a draft"). Every entry has one. */
	readonly description: string;
	readonly icon?: React.ReactNode;
	/**
	 * Runs the action. Return a promise for work that takes time: the action shows a spinner until it settles, and
	 * if it rejects, a retry button takes its place until it succeeds.
	 */
	readonly onSelect: DataTableRowHandler<TData>;
	/**
	 * The icon tile's colour. Left out, each entry takes the next hue of the palette in menu order (blue, violet, teal,
	 * green, orange), so the entries are told apart at a glance.
	 */
	readonly tone?: DataTableRowActionTone;
	/** Show the action as a button in the row itself, beside the ⋯ menu, for the one thing people do most. */
	readonly inline?: boolean;
	/**
	 * Whether this row offers the action (for example Retry only on a failed job). Rows it returns `false` for leave
	 * the action out of the menu, the inline buttons and the mobile card. Every row offers it when this is absent.
	 */
	readonly isAvailable?: DataTableRowPredicate<TData>;
}

/** A yes/no question about one row. */
export type DataTableRowPredicate<TData> = { bivarianceHack(row: TData): boolean }["bivarianceHack"];

/** Which rows a bulk action covers: the ticked rows of the page, or every row that matches the filters. */
export type DataTableSelectionScope = "page" | "all-matching";

/** What a bulk action is told about the selection. */
export interface DataTableBulkSelectionContext {
	readonly scope: DataTableSelectionScope;
	/** How many rows the action covers: the ticked rows, or every matching row under `all-matching`. */
	readonly totalMatchingRows: number;
}

/** What a bulk action does with the selected rows. */
export type DataTableBulkActionHandler<TData> = { bivarianceHack(rows: TData[], context: DataTableBulkSelectionContext): void | Promise<void> }["bivarianceHack"];

/** One button of the bar shown while rows are selected. */
export interface DataTableBulkAction<TData> {
	readonly key: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly onSelect: DataTableBulkActionHandler<TData>;
	readonly tone?: DataTableActionTone;
}

/** Row checkboxes and the bar they open. `selection={{}}` gives checkboxes with no actions. */
export interface DataTableSelection<TData> {
	readonly bulkActions?: readonly DataTableBulkAction<TData>[];
	/** Adds a destructive "Delete selected" action. */
	readonly onDelete?: DataTableBulkActionHandler<TData>;
	/** Controlled selection scope. Leave it out and the table keeps the scope itself. */
	readonly scope?: DataTableSelectionScope;
	/** Fires when the reader picks "select all matching rows" or drops back to the page. */
	readonly onScopeChange?: (scope: DataTableSelectionScope) => void;
	/**
	 * In a tree, ticking a row also ticks every row under it, and a row with only some of its children ticked shows
	 * a half-ticked box. On by default; `false` makes every row's tick its own.
	 */
	readonly cascade?: boolean;
}

/** The export menu. It exports the ticked rows when there are any, otherwise every row that matches the filters. */
export interface DataTableExporting<TData> {
	/** The formats offered. All four by default. */
	readonly formats?: readonly DataTableExportFormat[];
	/** The downloaded file's name. */
	readonly filename?: string;
	/**
	 * The row fields exported, by key and in this order: any field of the row, shown as a column or not (a currency
	 * kept beside an amount). Every data column by default. In the dialog these are listed first and ticked to start
	 * with, and the table's other columns follow, unticked.
	 */
	readonly keys?: readonly DataTableRowKey<TData>[];
	/**
	 * `menu` (default): one click per format. `dialog`: a dialog where the reader picks the format, which rows (ticked,
	 * matching the filters, or every row) and which columns, and sees how many rows will go out.
	 */
	readonly mode?: "menu" | "dialog";
}

// ── 7. Row structure ───────────────────────────────────────────────────────

/** Rows that hold child rows, drawn indented under a toggle. */
export interface DataTableTree<TData> {
	readonly getSubRows: DataTableSubRowsReader<TData>;
	/** Start with every branch open. */
	readonly defaultExpanded?: boolean;
	/** Pixels each level is indented by. */
	readonly indent?: number;
}

/**
 * Rows grouped by the value of one or more columns, each group a row of its own with a toggle, the value, how many
 * rows it holds, and a subtotal in every column that declares `aggregationFn` (`"sum"`, `"count"`, `"mean"`, `"min"`
 * or `"max"`; draw the subtotal with the column's `aggregatedCell`). The grouped-by columns move to the front.
 * Client and infinite sources only: a server groups its own rows.
 */
export interface DataTableGrouping {
	/** The column ids to group by, outermost first. An empty list shows the rows ungrouped. */
	readonly by: readonly string[];
	/** Start with every group open. */
	readonly defaultExpanded?: boolean;
}

/**
 * Extra content for one row. `row` (default): a full-width row under the opened one, opened from a toggle at the
 * start of the row. `panel`: a panel beside the table, opened by clicking a row (or Enter on it); ↑ and ↓ in the
 * panel move to the previous and next row, Escape closes it. Below 640px of table width the panel is a sheet. The
 * panel closes itself when a search or a filter hides its row.
 */
export interface DataTableDetail<TData> {
	readonly render: DataTableRowRenderer<TData>;
	readonly mode?: "row" | "panel";
	/** `panel` only: what the panel is called (its heading and accessible name), for the row it shows. */
	readonly title?: DataTableRowTitleReader<TData>;
	/** `panel` only: column ids to hide while the panel is open, to make room beside it. */
	readonly hideColumnsWhileOpen?: readonly string[];
}

/** A row's name, for a panel's heading. */
export type DataTableRowTitleReader<TData> = { bivarianceHack(row: TData): string }["bivarianceHack"];

/**
 * An "add row" button under the last row. What a click creates is the caller's business: add the new row to `data`
 * (and mark it with `rowStatus: "new"` until it is saved).
 */
export interface DataTableDraftRows {
	readonly onCreate: () => void;
	/** The button's label; "Add row" by default. */
	readonly label?: string;
}

/**
 * A drag grip on every row. Works with a pointer, touch and the keyboard. In a tree a row moves only among its
 * siblings: the move names their `parentId`, and `orderedIds` is the new order of those siblings.
 */
export interface DataTableRowReorder {
	readonly onReorder: (move: DataTableRowMove) => void;
}

// ── 8. Columns ─────────────────────────────────────────────────────────────

/** What readers may change about the columns. Each choice is saved when `preferences` is set. */
export interface DataTableColumnControls {
	/** A columns menu to hide and show columns. */
	readonly visibility?: boolean;
	/** Pin a column to the start or the end from its header menu. */
	readonly pinning?: boolean;
	/** Drag a header's edge (or use the arrow keys on it) to resize the column. */
	readonly resizing?: boolean;
	/** Move a column from its header menu. */
	readonly reordering?: boolean;
	/** A density menu in the toolbar: compact, comfortable or spacious rows. It starts from `layout.density`. */
	readonly density?: boolean;
}

// ── 9. Editing ─────────────────────────────────────────────────────────────

/**
 * Why a cell is being written. `edit`: the reader committed a value. `undo` / `redo`: the reader stepped through the
 * history. `revert`: a save returned a rejected promise, and the old value goes back.
 */
export type DataTableCellEditSource = "edit" | "undo" | "redo" | "revert";

/** One cell write. Write `value` to the row with id `rowId`. */
export interface DataTableCellEdit<TData> {
	readonly rowId: string;
	readonly columnId: string;
	readonly value: CellData;
	readonly previousValue: CellData;
	readonly row: TData;
	readonly source: DataTableCellEditSource;
}

/**
 * In-place editing. Which columns are editable is declared on the column: `meta: { cellEdit: { parse?, validate? } }`.
 * `validate` keeps the editor open with its message until the value is fixed.
 */
export interface DataTableEditing<TData> {
	/**
	 * Write the value. Return a promise to save it somewhere: the cell is marked while it saves, and if the promise
	 * rejects, this is called again with `source: "revert"` and the old value, and the cell is marked as failed.
	 */
	readonly onCellEdit: { bivarianceHack(edit: DataTableCellEdit<TData>): void | Promise<void> }["bivarianceHack"];
	/** What opens the editor with a pointer. Enter and F2 always do. */
	readonly trigger?: "double-click" | "click";
	/**
	 * Undo and redo buttons in the toolbar, and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z on the table. Each step is written back
	 * through `onCellEdit` with `source: "undo"` or `"redo"`. Only saved edits can be undone.
	 */
	readonly history?: boolean;
}

// ── 10. Look ───────────────────────────────────────────────────────────────

export interface DataTableLayout {
	/** How much room each row takes. */
	readonly density?: DataTableDensity;
	/** Tint every other row. */
	readonly striped?: boolean;
	/** Draw a line between columns. */
	readonly cellBorders?: boolean;
	/** Keep the header in view while the body scrolls. Needs `maxHeight`. */
	readonly stickyHeader?: boolean;
	/** `fixed` (default) gives every column its declared width; `auto` sizes columns to their content. */
	readonly width?: "auto" | "fixed";
	/** The tallest the table body may grow before it scrolls: pixels, or any CSS length. */
	readonly maxHeight?: number | string;
}

/** Draw only what is in view, for long or wide tables. */
export interface DataTableVirtualize {
	readonly rows?: boolean;
	readonly columns?: boolean;
	/** A row's height in pixels before it is measured. */
	readonly estimateRowHeight?: number;
}

/** Draws one row as a card on narrow screens. It is given the row and the row actions it may offer. */
export type DataTableMobileCardRenderer<TData> = { bivarianceHack(row: TData, rowActions: readonly DataTableRowAction<TData>[]): React.ReactNode }["bivarianceHack"];

// ── 11. Remembering ────────────────────────────────────────────────────────

/** Remembers hidden, pinned, reordered and resized columns, the sort, the page size and the density the reader picked. */
export interface DataTablePreferences {
	/** A key unique to this table. */
	readonly key: string;
	/** Where the preferences are kept; the browser's local storage by default. */
	readonly storage?: DataTableStorageAdapter;
}

// ── 12. Standard ───────────────────────────────────────────────────────────

/** Per-table overrides of the table's copy. No key is shared by the two families, so one flat object covers both. */
export type DataTableLabelsOverride = Partial<DataTableLabels> & Partial<TableEngineLabels>;

/** The three props every table needs. */
export interface DataTableRecordProps<TData extends RowData> {
	// ── 1. The records ────────────────────────────────────────────────────
	/** The rows. In server mode, the current page only. */
	readonly data: readonly TData[];
	/** TanStack column definitions. A string `header` becomes a sortable header with that title. */
	readonly columns: DataTableColumns<TData>;
	/** A row's stable id. Selection, editing, reordering and expansion all address rows by it. */
	readonly getRowId: DataTableRowIdReader<TData>;
}

/** One optional prop per job. A job is off while its prop is absent. */
export interface DataTableFeatureProps<TData extends RowData> {
	// ── 2. Where the rows come from ───────────────────────────────────────
	/** `{ mode: "client" }` (default), `{ mode: "server", … }` or `{ mode: "infinite", … }`. */
	readonly source?: DataTableSource<TData>;

	// ── 3. Chrome ─────────────────────────────────────────────────────────
	/** The title, description and actions above the table. */
	readonly heading?: DataTableHeading;
	/** The toolbar's layout and your own controls in it. */
	readonly toolbar?: DataTableToolbar;
	/** Totals and summary rows under the body. */
	readonly footer?: DataTableFooter;

	// ── 4. Status ─────────────────────────────────────────────────────────
	/** Loading and error state. */
	readonly status?: DataTableStatus;
	/** What to show when there are no rows at all. */
	readonly emptyState?: DataTableEmptyState;

	// ── 5. Finding rows ───────────────────────────────────────────────────
	/** A search box over the named columns. */
	readonly search?: DataTableSearch<TData>;
	/** Filters in the toolbar. */
	readonly filters?: readonly DataTableFilter[];
	/** How header clicks cycle the sort. Sorting itself is on for every column unless the column says otherwise. */
	readonly sorting?: DataTableSortingOptions;
	/** Pages the rows and shows the pager. Without it a client table shows every row. */
	readonly paging?: DataTablePaging;

	// ── 6. Acting on rows ─────────────────────────────────────────────────
	/** Fires when a row is clicked, or activated with Enter or Space. */
	readonly onRowClick?: DataTableRowHandler<TData>;
	/** The ⋯ menu at the end of each row. */
	readonly rowActions?: readonly DataTableRowAction<TData>[];
	/** Row checkboxes and bulk actions. */
	readonly selection?: DataTableSelection<TData>;
	/** The export menu. */
	readonly exporting?: DataTableExporting<TData>;

	// ── 7. Row structure ──────────────────────────────────────────────────
	/** Rows with child rows. */
	readonly tree?: DataTableTree<TData>;
	/** Rows grouped by a column's value, with subtotals. */
	readonly grouping?: DataTableGrouping;
	/** Extra content under a row. */
	readonly detail?: DataTableDetail<TData>;
	/** Drag rows to reorder them. */
	readonly rowReorder?: DataTableRowReorder;
	/** A pin button on every row, to keep it at the top. */
	readonly rowPinning?: boolean;
	/** A lifecycle mark per row: new, dirty or deleted. */
	readonly rowStatus?: DataTableRowStatusReader<TData>;
	/** An "add row" button under the last row. */
	readonly draftRows?: DataTableDraftRows;

	// ── 8. Columns ────────────────────────────────────────────────────────
	/** What readers may change about the columns. */
	readonly columnControls?: DataTableColumnControls;

	// ── 9. Editing ────────────────────────────────────────────────────────
	/** In-place cell editing. */
	readonly editing?: DataTableEditing<TData>;

	// ── 10. Look ──────────────────────────────────────────────────────────
	/** Density, stripes, borders, sticky header, width and height. */
	readonly layout?: DataTableLayout;
	/** Draw only the rows and columns in view. */
	readonly virtualize?: DataTableVirtualize;
	/**
	 * Draws each row as a card when the TABLE is narrower than 640px: on a phone, and in a narrow panel on a wide
	 * screen. Until the table is measured (the first render) the window decides.
	 */
	readonly mobileCard?: DataTableMobileCardRenderer<TData>;

	// ── 11. Remembering ───────────────────────────────────────────────────
	/** Saves the reader's column and paging choices. */
	readonly preferences?: DataTablePreferences;

	// ── 12. Standard ──────────────────────────────────────────────────────
	/** Overrides some of the table's copy. Keep it a module constant. */
	readonly labels?: DataTableLabelsOverride | undefined;
	/** Classes for the outer element. */
	readonly className?: string;
	/** The table's outer element. */
	readonly ref?: React.Ref<HTMLDivElement>;
}

/** Each optional prop may also be passed as `undefined`, so a caller can write `status={isLoading ? LOADING : undefined}`. */
type WithUndefined<TProps> = { [TKey in keyof TProps]: TProps[TKey] | undefined };

/** `DataTable`'s props: the records, then one optional prop per job. */
export type DataTableProps<TData extends RowData> = DataTableRecordProps<TData> & WithUndefined<DataTableFeatureProps<TData>>;

/** What the table and the filter controls pass between them. */
export type DataTableFilterChangeHandler = (column: string, value: DataTableFilterValue | null) => void;
