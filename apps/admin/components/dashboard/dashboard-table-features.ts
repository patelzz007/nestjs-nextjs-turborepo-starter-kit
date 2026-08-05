// ============================================================
// dashboard-table-features.ts
// ============================================================
// The v9 TanStack Table feature set used by the dashboard table.
//
// v9 is a paradigm shift from v8: instead of `useReactTable()` with
// `getCoreRowModel()`, `getSortedRowModel()` … factories, you compose an
// explicit, tree-shakeable `features` object ONCE at module scope via
// `tableFeatures()` and pass it to `useTable({ features, ... })`. Row model
// factories and fn registries (`sortFns`, `filterFns`) live on the features
// object, and every enabled feature is a named export from the package.
//
// `DashboardFeatures` is the inferred feature type — both the table and the
// column defs are typed against it (`Table<DashboardFeatures, RowData>`,
// `ColumnDef<DashboardFeatures, RowData>`), so the compiler enforces that the
// columns only use APIs the registered features actually provide.
// ============================================================

import {
	columnFacetingFeature,
	columnFilteringFeature,
	columnVisibilityFeature,
	createFacetedRowModel,
	createFacetedUniqueValues,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFns,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFns,
	tableFeatures,
} from "@tanstack/react-table";

/** The dashboard table's full feature set — built once, shared by both files. */
export const dashboardFeatures = tableFeatures({
	// Features (each is a self-contained slice of state + prototype APIs).
	columnFacetingFeature,
	columnFilteringFeature,
	columnVisibilityFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	// Row model factories — these are what make pagination/sorting/filtering/
	// faceting actually compute. The core row model is always implicit in v9.
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	facetedRowModel: createFacetedRowModel(),
	facetedUniqueValues: createFacetedUniqueValues(),
	// Built-in fn registries (keeps `sortFn`/`filterFn` string options typed).
	filterFns,
	sortFns,
});

/** The inferred feature-type — used to type `Table`/`Row`/`Column`/`ColumnDef`. */
export type DashboardFeatures = typeof dashboardFeatures;
