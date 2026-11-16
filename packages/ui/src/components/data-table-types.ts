// DataTable's public types (enhancement 8.1: split from data-table.tsx): its props, filters, actions and empty
// state, and the TanStack feature set every table uses. Re-exported by data-table.tsx.

import {
	type ColumnDef,
	type RowData,
	type SortingState,
	columnFacetingFeature,
	columnFilteringFeature,
	columnPinningFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	tableFeatures,
} from "@tanstack/react-table";
import * as React from "react";
import { type DataTableCheckboxConfig } from "@workspace/ui/lib/data-table/checkbox";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { type DataTableCellScalar } from "@workspace/ui/lib/data-table/prefs";
import { type DataTablePagination } from "@workspace/ui/lib/data-table/pagination";
import { type DataTableStorageAdapter } from "@workspace/ui/lib/data-table/storage";

/**
 * The feature set every DataTable instance uses. v9 exposes the row models and
 * fn registries here instead of as `useReactTable` options, so the shared
 * component composes them ONCE at module scope and types its columns against
 * the inferred `DataTableFeatures` type.
 */
export const dataTableFeatures = tableFeatures({
	// Features (each is a self-contained slice of state + prototype APIs).
	columnFacetingFeature,
	columnFilteringFeature,
	columnPinningFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	// Row model factories — the core row model is implicit in v9.
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	facetedRowModel: createFacetedRowModel(),
	facetedUniqueValues: createFacetedUniqueValues(),
});

/** The inferred feature type — used to type `ColumnDef<DataTableFeatures, TData>`. */
export type DataTableFeatures = typeof dataTableFeatures;

/** How the toolbar lays out the search and the column filters (`toolbarLayout`). */
export type DataTableToolbarLayout = "inline" | "fill";

/** One choice of a column filter. */
export interface FilterOption {
	readonly value: string;
	readonly label: string;
	/**
	 * A decorative glyph shown before the label in the open list (the label still names the choice). When any
	 * option of a filter has one, its "All" choice gets one too, so the labels stay in one column.
	 */
	readonly icon?: React.ReactNode;
}

export interface Filter {
	readonly key: string;
	readonly label: string;
	readonly options: readonly FilterOption[];
}

export interface Action<TData extends RowData = RowData> {
	readonly key: string;
	readonly label: string;
	readonly description?: string;
	readonly icon: React.ReactNode;
	readonly onClick: (row: TData) => void;
	readonly variant?: "default" | "destructive";
	readonly className?: string;
	readonly iconBgColor?: string;
	readonly isDestructive?: boolean;
}

export interface EmptyStateConfig {
	readonly icon?: React.ReactNode;
	readonly title?: string;
	readonly description?: string;
	readonly action?: {
		readonly label: string;
		readonly onClick: () => void;
	};
}

// ── DataTable Props ────────────────────────────────────────────────────────

export interface DataTableProps<TData extends RowData> {
	/** The table's outer element. */
	readonly ref?: React.Ref<HTMLDivElement>;
	// Core
	/** The rows. In server mode, only the current page. */
	readonly data: readonly TData[];
	/** TanStack column definitions, typed against `DataTableFeatures`. Keep the array stable. */
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	/** Select filters shown in the toolbar, each on one column `key`. */
	readonly filters?: Filter[];
	/** Row actions, shown in a ⋯ menu at the end of each row and on mobile cards. */
	readonly actions?: Action<TData>[];
	/** The columns the toolbar's search matches against. No search field without it. */
	readonly searchKeys?: string[];
	/** Rows per page to start with. */
	readonly pageSize?: number;
	/** The page sizes people can pick. */
	readonly pageSizeOptions?: readonly number[];
	/** `{ mode: "client" }` (the default) or `{ mode: "server", totalCount, pageIndex, pageSize, onPageChange, getRowId }` when the parent fetches each page. */
	readonly pagination?: DataTablePagination<TData>;
	/** The table's title, above the toolbar. */
	readonly title?: string;
	/** A line under the title. */
	readonly description?: string;

	// Responsive
	/** Renders each row as a card below the `lg` breakpoint, instead of a table row. */
	readonly mobileCardRender?: (item: TData, actions?: Action<TData>[]) => React.ReactNode;

	// Bulk selection, bulk actions and export
	/** Row checkboxes: `true`, or a config with bulk actions, a bulk delete and export formats. */
	readonly checkbox?: boolean | DataTableCheckboxConfig<TData>;

	// Empty state
	/** What to show when there are no rows: an icon, a title, a description and an action. */
	readonly emptyState?: EmptyStateConfig;

	// Appearance
	/** Classes for the outer element. */
	readonly className?: string;

	// ── NEW FEATURE 1: Row click ──────────────────────────────────────────
	/** Fires when a row is clicked or activated with Enter or Space. */
	readonly onRowClick?: (row: TData) => void;

	// ── NEW FEATURE 2: Column visibility toggle ───────────────────────────
	/** Adds a columns menu to hide and show columns. */
	readonly enableColumnVisibility?: boolean;

	// ── NEW FEATURE 4: Preference persistence ─────────────────────────────
	/** Remembers hidden and pinned columns and the page size under this key. */
	readonly persistKey?: string;
	/** Where `persistKey` preferences are kept; local storage by default. */
	readonly storage?: DataTableStorageAdapter;

	// ── Bulk selection: cross-page select-all (controlled or internal) ────
	/** Whether the selection spans every matching row, not just the page, controlled. */
	readonly selectAllPages?: boolean;
	/** Fires when "select all" switches between the page and every matching row. */
	readonly onSelectAllPagesChange?: (selectAllPages: boolean) => void;

	// ── Column pinning ──────────────────────────────────────────────────────
	/** Lets people pin columns to the start or the end. */
	readonly enableColumnPinning?: boolean;

	/** Fires when the user clicks a column header in server mode. The parent owns the sort state and must re-fetch data. */
	readonly onManualSortingChange?: (sorting: SortingState) => void;
	/** Controlled column-filter values when `manual` is true (server owns the row set). */
	readonly manualColumnFilters?: Readonly<Record<string, string>>;
	/** Fires with a filter's key and value in server mode, where the parent filters. */
	readonly onManualColumnFilterChange?: (filterKey: string, value: string | null) => void;
	/** Controlled sorting state — overrides the internal sorting so header sort indicators stay in sync with the parent's server-side sort. */
	readonly sorting?: SortingState;

	// ── NEW FEATURE 7: Inline editing ─────────────────────────────────────
	/** Lets cells be edited in place (double-click; Enter saves, Escape cancels). */
	readonly editable?: boolean;
	/** The columns that can be edited, by id. All of them when absent. */
	readonly editableColumns?: string[];
	// The `row` original is passed alongside the index so consumers can map the
	// edit back to the record by stable id — indices alone are unreliable once
	// sorting, filtering or pagination re-orders the row model.
	/** Fires with the row index, the column id, the new value and the row, to write the edit back by the row's id. */
	readonly onCellEdit?: (rowIndex: number, columnId: string, value: DataTableCellScalar, row: TData) => void;

	// ── NEW FEATURE 8: Drag-and-drop rows ─────────────────────────────────
	/** Adds a drag grip to rows. Pointer-only: offer move actions for keyboard users. */
	readonly draggable?: boolean;
	// `rows` is the current visible (filtered/sorted/paginated) row originals in
	// display order, so consumers can reorder by id instead of raw indices.
	/** Fires on drop with the from and to positions and the visible rows, to reorder by id. */
	readonly onRowReorder?: (fromIndex: number, toIndex: number, rows: TData[]) => void;

	// ── Perf: Debounced global search ────────────────────────────────────
	/** How long typing settles before the search filters the rows. */
	readonly searchDebounceMs?: number;

	// ── Perf: Row virtualization ─────────────────────────────────────────
	/** Draws only the rows in view, for long local datasets. */
	readonly virtualizeRows?: boolean;
	/** Each row's height in pixels, for virtualisation. */
	readonly virtualRowHeight?: number;
	/** The scrolling body's height in pixels, for virtualisation. */
	readonly maxHeight?: number;

	// ── Robustness: Loading / error states ──────────────────────────────
	/** Initial load — replaces the table with skeleton rows. */
	readonly isLoading?: boolean;
	/** Background refetch (e.g. server pagination) — keeps rows visible with a subtle dim. */
	readonly isRefetching?: boolean;
	/** How many skeleton rows `isLoading` draws. */
	readonly skeletonRows?: number;
	/** An error message to show in place of the rows. */
	readonly error?: string | null;

	// ── Robustness: Sort cycle ──────────────────────────────────────────
	/** `asc-desc`, or `asc-desc-none` to return to the original order on the third click. */
	readonly sortCycle?: "asc-desc" | "asc-desc-none";

	// ── Toolbar layout ────────────────────────────────────────────────
	/**
	 * `inline` (default): the search is a fixed width and the filters take what is left, wrapping when they
	 * do not fit. `fill`: from `sm` up the search and every filter are equal columns across the whole
	 * toolbar row — for a table whose filters are its main controls (the docs' endpoint explorer).
	 */
	readonly toolbarLayout?: DataTableToolbarLayout;

	// ── Custom toolbar content ────────────────────────────────────────
	/** Render custom content in the toolbar row (left of export/column buttons). */
	readonly toolbarContent?: React.ReactNode;

	/** Per-table overrides of the `dataTable` copy from `UiKitLabelsProvider` (menus and affordances). */
	readonly labels?: UiKitLabelsOverride<"dataTable"> | undefined;
}

// ── Editable Cell ──────────────────────────────────────────────────────────

export interface EditingCell {
	readonly rowIndex: number;
	readonly columnId: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────
