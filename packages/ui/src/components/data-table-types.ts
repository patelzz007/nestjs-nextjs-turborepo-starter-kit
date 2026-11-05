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
	readonly ref?: React.Ref<HTMLDivElement>;
	// Core
	readonly data: readonly TData[];
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	readonly filters?: Filter[];
	readonly actions?: Action<TData>[];
	readonly searchKeys?: string[];
	readonly pageSize?: number;
	readonly pageSizeOptions?: readonly number[];
	readonly pagination?: DataTablePagination<TData>;
	readonly title?: string;
	readonly description?: string;

	// Responsive
	readonly mobileCardRender?: (item: TData, actions?: Action<TData>[]) => React.ReactNode;

	// Bulk selection, bulk actions and export
	readonly checkbox?: boolean | DataTableCheckboxConfig<TData>;

	// Empty state
	readonly emptyState?: EmptyStateConfig;

	// Appearance
	readonly className?: string;

	// ── NEW FEATURE 1: Row click ──────────────────────────────────────────
	readonly onRowClick?: (row: TData) => void;

	// ── NEW FEATURE 2: Column visibility toggle ───────────────────────────
	readonly enableColumnVisibility?: boolean;

	// ── NEW FEATURE 4: Preference persistence ─────────────────────────────
	readonly persistKey?: string;
	readonly storage?: DataTableStorageAdapter;

	// ── Bulk selection: cross-page select-all (controlled or internal) ────
	readonly selectAllPages?: boolean;
	readonly onSelectAllPagesChange?: (selectAllPages: boolean) => void;

	// ── Column pinning ──────────────────────────────────────────────────────
	readonly enableColumnPinning?: boolean;

	/** Fires when the user clicks a column header in server mode. The parent owns the sort state and must re-fetch data. */
	readonly onManualSortingChange?: (sorting: SortingState) => void;
	/** Controlled column-filter values when `manual` is true (server owns the row set). */
	readonly manualColumnFilters?: Readonly<Record<string, string>>;
	readonly onManualColumnFilterChange?: (filterKey: string, value: string | null) => void;
	/** Controlled sorting state — overrides the internal sorting so header sort indicators stay in sync with the parent's server-side sort. */
	readonly sorting?: SortingState;

	// ── NEW FEATURE 7: Inline editing ─────────────────────────────────────
	readonly editable?: boolean;
	readonly editableColumns?: string[];
	// The `row` original is passed alongside the index so consumers can map the
	// edit back to the record by stable id — indices alone are unreliable once
	// sorting, filtering or pagination re-orders the row model.
	readonly onCellEdit?: (rowIndex: number, columnId: string, value: DataTableCellScalar, row: TData) => void;

	// ── NEW FEATURE 8: Drag-and-drop rows ─────────────────────────────────
	readonly draggable?: boolean;
	// `rows` is the current visible (filtered/sorted/paginated) row originals in
	// display order, so consumers can reorder by id instead of raw indices.
	readonly onRowReorder?: (fromIndex: number, toIndex: number, rows: TData[]) => void;

	// ── Perf: Debounced global search ────────────────────────────────────
	readonly searchDebounceMs?: number;

	// ── Perf: Row virtualization ─────────────────────────────────────────
	readonly virtualizeRows?: boolean;
	readonly virtualRowHeight?: number;
	readonly maxHeight?: number;

	// ── Robustness: Loading / error states ──────────────────────────────
	/** Initial load — replaces the table with skeleton rows. */
	readonly isLoading?: boolean;
	/** Background refetch (e.g. server pagination) — keeps rows visible with a subtle dim. */
	readonly isRefetching?: boolean;
	readonly skeletonRows?: number;
	readonly error?: string | null;

	// ── Robustness: Sort cycle ──────────────────────────────────────────
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
