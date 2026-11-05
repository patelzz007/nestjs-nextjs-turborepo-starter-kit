"use client";

// ============================================================
// components/data-table.tsx
//
// A fully-featured, generic data table built on TanStack Table **v9**
// (`useTable` + a module-scope `tableFeatures()` feature set — the v9
// paradigm).
//
// The component is deliberately **dumb** (rules 9/10/11): the smart component
// owns the data, the column defs, the filters and the actions. Every string
// (search placeholder, empty state, export labels, action labels) comes from
// the `dataTable` family of `UiKitLabelsProvider`, overridable per table via
// `labels` — nothing is fetched or hardcoded here.
//
// Features: search (global filter over `searchKeys`), column filters, column
// visibility, column pinning, CSV/JSON/PDF/Excel export, localStorage
// preference persistence, row click, inline editing, native HTML5 drag-and-drop
// row reordering, bulk selection (+select-all-pages), a mobile card view, and
// server-side (`manual`) mode.
// ============================================================

import { isNumberPrimitive } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import {
	flexRender,
	useTable,
	Subscribe,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnPinningState,
	type ColumnVisibilityState,
	type PaginationState,
	type RowData,
	type SortingState,
	type TableOptions,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleAlert, Loader2, Search, Trash2, X } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { assertDataTableFiltersMatchColumns, assertUniqueDataTableColumnIds, DATA_TABLE_UTILITY_COLUMN_ID } from "@workspace/ui/lib/data-table/column-ids";
import { DESKTOP_MEDIA_QUERY } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveDataTableCheckboxConfig, type DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table/checkbox";
import { formatDataTableLabel } from "@workspace/ui/lib/data-table/labels";
import {
	DataTableCellScalarSchema,
	DataTableCellValueSchema,
	normalizeFacetedUniqueValues,
	reconcileDataTablePrefs,
	toDataTableCellString,
	type DataTablePersistedPrefs,
	type DataTablePersistedPrefsPatch,
} from "@workspace/ui/lib/data-table/prefs";
import { isServerPagination, type DataTablePagination } from "@workspace/ui/lib/data-table/pagination";
import { createLocalStorageDataTableStorage, type DataTableStorageAdapter } from "@workspace/ui/lib/data-table/storage";
import { PageNumberButton, PageSizeSelect } from "./data-table-pagination";
import { DragHandleCell, HeaderCell, MobileCardView, NoResults, RowActionsMenu, SelectAllCheckbox, SelectRowCheckbox, SkeletonRow, TableRowView } from "./data-table-rows";
import { applyTableUpdater, bulkSelectionSurfaceClasses, rowSelectionSelector } from "./data-table-shared";
import { BulkSelectionBar, type BulkSelectionBarProps, ColumnFilterSelect, ColumnVisibilityMenu, ExportMenu, MobileSelectionBar } from "./data-table-toolbar";
import { type Action, type DataTableFeatures, type DataTableProps, type EditingCell, type Filter, dataTableFeatures } from "./data-table-types";

export {
	type Action,
	type DataTableFeatures,
	type DataTableProps,
	type DataTableToolbarLayout,
	type EmptyStateConfig,
	type Filter,
	type FilterOption,
	dataTableFeatures,
} from "./data-table-types";
export type { DataTableLabels } from "@workspace/ui/lib/data-table/labels";
export type { DataTableStorageAdapter } from "@workspace/ui/lib/data-table/storage";
export { createLocalStorageDataTableStorage } from "@workspace/ui/lib/data-table/storage";
export type { DataTableBulkAction, DataTableBulkSelectionContext, DataTableCheckboxConfig, DataTableExportFormat } from "@workspace/ui/lib/data-table/checkbox";
export { DATA_TABLE_EXPORT_FORMATS, resolveDataTableCheckboxConfig } from "@workspace/ui/lib/data-table/checkbox";
export type { DataTablePagination, DataTableClientPagination, DataTableServerPagination } from "@workspace/ui/lib/data-table/pagination";
export { isServerPagination } from "@workspace/ui/lib/data-table/pagination";
export { sanitizeExportCell, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet, buildExportColumns } from "@workspace/ui/lib/data-table/export";

/** Default row height (px) for row virtualization — matches the `h-18` row class. */
const DEFAULT_ROW_HEIGHT = 72;

/** Rows rendered above/below the visible band while virtualizing. */
const VIRTUAL_OVERSCAN = 6;

/** Default page-size options when `pageSizeOptions` is not provided. */
const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 50, 100];

const EMPTY_FILTERS: Filter[] = [];
const EMPTY_ACTIONS: Action[] = [];
const EMPTY_SEARCH_KEYS: string[] = [];
const EMPTY_FACETED_COUNTS: ReadonlyMap<string, number> = new Map<string, number>();

const dataTableShellVariants = cva("w-full", {
	variants: {
		state: {
			default: "",
			loading: "opacity-95",
			error: "border-destructive/40",
		},
	},
	defaultVariants: {
		state: "default",
	},
});

type DataTableShellState = NonNullable<VariantProps<typeof dataTableShellVariants>["state"]>;

interface DataTableShellProps extends React.ComponentProps<typeof Card>, VariantProps<typeof dataTableShellVariants> {}

const DataTableShell = React.forwardRef<HTMLDivElement, DataTableShellProps>(function DataTableShell({ className, state, ...props }, ref): React.JSX.Element {
	return <Card ref={ref} className={cn(dataTableShellVariants({ state }), className)} {...props} />;
});

// ── Filter / Action Types ──────────────────────────────────────────────────

export function DataTable<TData extends RowData>({
	ref,
	// Core
	data,
	columns: initialColumns,
	filters = EMPTY_FILTERS,
	actions = EMPTY_ACTIONS,
	searchKeys = EMPTY_SEARCH_KEYS,
	toolbarLayout = "inline",
	pageSize = 10,
	pageSizeOptions,
	pagination: paginationProp,
	title,
	description,

	// Responsive
	mobileCardRender,

	// Bulk selection
	checkbox,

	// Empty state
	emptyState,

	// Appearance
	className,

	// NEW FEATURE 1: Row click
	onRowClick,

	// NEW FEATURE 2: Column visibility
	enableColumnVisibility = false,

	// NEW FEATURE 4: Preference persistence
	persistKey,
	storage,

	// Bulk selection: cross-page select-all
	selectAllPages: selectAllPagesProp,
	onSelectAllPagesChange,

	// Column pinning
	enableColumnPinning = false,

	onManualSortingChange,
	manualColumnFilters,
	onManualColumnFilterChange,
	sorting: controlledSorting,

	// NEW FEATURE 7: Inline editing
	editable = false,
	editableColumns,
	onCellEdit,

	// NEW FEATURE 8: Drag-and-drop rows
	draggable = false,
	onRowReorder,

	// Perf: Debounced global search
	searchDebounceMs = 0,

	// Perf: Row virtualization
	virtualizeRows = false,
	virtualRowHeight,
	maxHeight,

	// Robustness: Loading / error states
	isLoading = false,
	isRefetching = false,
	skeletonRows = 5,
	error,

	// Robustness: Sort cycle
	sortCycle = "asc-desc",

	// Custom toolbar content
	toolbarContent,

	labels: labelsOverride,
}: DataTableProps<TData>): React.JSX.Element {
	const labels = useUiKitLabels("dataTable", labelsOverride);
	const pageSizeShowId = React.useId();
	const pageSizePerPageId = React.useId();
	// Server snapshot `true`: SSR and hydration render the desktop layout first.
	const isDesktopViewport = useMediaQuery(DESKTOP_MEDIA_QUERY, true);
	const resolvedPagination = useMemo((): DataTablePagination<TData> => {
		if (paginationProp !== undefined) {
			return paginationProp;
		}
		return { mode: "client", defaultPageSize: pageSize };
	}, [paginationProp, pageSize]);
	const isServerMode = isServerPagination(resolvedPagination);
	const serverPagination = isServerMode ? resolvedPagination : null;
	const controlledPageIndex = serverPagination?.pageIndex ?? 0;
	const serverPageSize = serverPagination?.pageSize;
	const serverTotalCount = serverPagination?.totalCount;
	const serverResetKey = serverPagination?.resetKey ?? "";
	const onFetchAllMatching = serverPagination?.onFetchAllMatching;
	const onClearServerFilters = serverPagination?.onClearFilters;
	const serverIsFiltered = serverPagination?.isFiltered ?? false;

	const deleteSelectedIcon = useMemo((): React.JSX.Element => <Trash2 className="h-4 w-4" />, []);

	const resolvedCheckbox = useMemo(
		(): ReturnType<typeof resolveDataTableCheckboxConfig<TData>> =>
			resolveDataTableCheckboxConfig({
				checkbox,
				labels,
				deleteSelectedIcon,
			}),
		[checkbox, labels, deleteSelectedIcon],
	);

	const {
		enableBulkSelection: resolvedEnableBulkSelection,
		bulkActions: resolvedBulkActions,
		exportable: resolvedExportable,
		exportFormats: resolvedExportFormats,
		exportFilename: resolvedExportFilename,
		exportableColumns: resolvedExportableColumns,
	} = resolvedCheckbox;

	const resolvedStorage = useMemo((): DataTableStorageAdapter | null => {
		if (storage !== undefined) {
			return storage;
		}
		if (persistKey !== undefined) {
			return createLocalStorageDataTableStorage();
		}
		return null;
	}, [storage, persistKey]);

	// ── State (persisted prefs load lazily once, from the initializer) ────
	const finalPageSizeOptions = useMemo(() => pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS, [pageSizeOptions]);
	const defaultClientPageSize = resolvedPagination.mode === "client" ? (resolvedPagination.defaultPageSize ?? pageSize) : pageSize;

	const columnIds = useMemo((): string[] => {
		return initialColumns
			.map((column) => {
				if ("id" in column) {
					return column.id;
				}
				if ("accessorKey" in column) {
					const accessorKey = column.accessorKey;
					if (isNumberPrimitive(accessorKey)) {
						return accessorKey.toString();
					}
					return accessorKey;
				}
				return undefined;
			})
			.filter((columnId): columnId is string => columnId !== undefined);
	}, [initialColumns]);

	const [persistedPrefs] = useState<DataTablePersistedPrefs | null>(() => {
		if (persistKey === undefined || resolvedStorage === null) {
			return null;
		}
		return resolvedStorage.read(persistKey);
	});

	const reconciledPrefs = useMemo(
		() =>
			reconcileDataTablePrefs({
				prefs: persistedPrefs,
				columnIds,
				pageSizeOptions: finalPageSizeOptions,
				defaultPageSize: defaultClientPageSize,
				isServerMode,
			}),
		[persistedPrefs, columnIds, finalPageSizeOptions, defaultClientPageSize, isServerMode],
	);

	const [sorting, setSorting] = useState<SortingState>(() => reconciledPrefs.sorting);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: isServerMode ? (serverPageSize ?? defaultClientPageSize) : reconciledPrefs.pageSize,
	}));
	// NOTE (#6): `rowSelection` is intentionally NOT a controlled slice here.
	// The v9 table owns it internally through its `rowSelection` atom, and the
	// UI opts into updates via `table.Subscribe` (bulk bars, header box, row
	// checkboxes). Keeping it out of React state + out of the `useTable`
	// selector means a row toggle re-renders only those islands — never the
	// toolbar, pager or the row list.
	const isSelectAllPagesControlled = onSelectAllPagesChange !== undefined;
	const [uncontrolledSelectAllPages, setUncontrolledSelectAllPages] = useState(false);
	const selectAllPages = isSelectAllPagesControlled ? (selectAllPagesProp ?? false) : uncontrolledSelectAllPages;

	const setSelectAllPages = useCallback(
		(value: boolean): void => {
			if (isSelectAllPagesControlled) {
				onSelectAllPagesChange(value);
			} else {
				setUncontrolledSelectAllPages(value);
			}
		},
		[isSelectAllPagesControlled, onSelectAllPagesChange],
	);

	// NEW FEATURE 2: Column visibility state
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => reconciledPrefs.columnVisibility);

	// NEW FEATURE 5: Column pinning state (v9: start/end arrays, not a flat map)
	const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => reconciledPrefs.columnPinning);

	// NEW FEATURE 7: Inline editing state
	const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

	// NEW FEATURE 8: Dragging state
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// Perf: Debounced search — `searchInput` drives the controlled input,
	// `globalFilter` (the applied value) updates only after the debounce
	// window, so typing re-renders the toolbar but not the table body.
	const [searchInput, setSearchInput] = useState("");
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Perf: Virtualization — the scroll offset of the table container.
	const [scrollTop, setScrollTop] = useState(0);

	useEffect((): (() => void) => {
		return (): void => {
			if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
		};
	}, []);

	// ── Save preferences ───────────────────────────────────────────────
	const persistPreferences = useCallback(
		(updates: DataTablePersistedPrefsPatch): void => {
			if (persistKey === undefined || resolvedStorage === null) {
				return;
			}
			resolvedStorage.write(persistKey, updates);
		},
		[persistKey, resolvedStorage],
	);

	const handleAnyDeselect = useCallback((): void => {
		setSelectAllPages(false);
	}, [setSelectAllPages]);

	// ── Build columns ──────────────────────────────────────────────────
	const columns = useMemo<ColumnDef<DataTableFeatures, TData>[]>(() => {
		const cols: ColumnDef<DataTableFeatures, TData>[] = [];

		// Drag handle column (NEW FEATURE 8)
		if (draggable) {
			cols.push({
				id: DATA_TABLE_UTILITY_COLUMN_ID.drag,
				header: "",
				cell: () => <DragHandleCell />,
				enableSorting: false,
				enableHiding: false,
				enablePinning: false,
				size: 40,
				minSize: 40,
				maxSize: 40,
			});
		}

		// Selection checkbox column
		if (resolvedEnableBulkSelection) {
			cols.push({
				id: DATA_TABLE_UTILITY_COLUMN_ID.select,
				header: ({ table }) => <SelectAllCheckbox table={table} onAnyDeselect={handleAnyDeselect} labels={labels} />,
				cell: ({ row, table }) => <SelectRowCheckbox row={row} table={table} onAnyDeselect={handleAnyDeselect} labels={labels} />,
				enableSorting: false,
				enableHiding: false,
				enablePinning: false,
				size: 40,
				minSize: 40,
				maxSize: 40,
			});
		}

		cols.push(...initialColumns);

		// Actions column
		if (actions.length > 0) {
			cols.push({
				id: DATA_TABLE_UTILITY_COLUMN_ID.actions,
				header: labels.actionsColumnHeader,
				cell: ({ row }) => <RowActionsMenu row={row} actions={actions} labels={labels} />,
				enableSorting: false,
				enableHiding: false,
				enablePinning: false,
				size: 80,
				minSize: 80,
				maxSize: 80,
			});
		}

		// A caller's column must not reuse a utility id or another column's id: React would key two cells per row alike.
		assertUniqueDataTableColumnIds(cols);
		// Client-side filters filter columns, so each must name one; server-side filters are query
		// parameters, never looked up as columns (see handleFilterChange / getFilterValue below).
		if (!isServerMode) {
			assertDataTableFiltersMatchColumns(
				filters.map((filter: Filter): string => filter.key),
				cols,
			);
		}
		return cols;
	}, [initialColumns, actions, labels, resolvedEnableBulkSelection, draggable, handleAnyDeselect, isServerMode, filters]);

	// ── Editable Columns Set ────────────────────────────────────────────
	const editableSet = useMemo<ReadonlySet<string>>(() => {
		if (!editable || !editableColumns) return new Set<string>();
		return new Set(editableColumns);
	}, [editable, editableColumns]);

	// ── Table instance ─────────────────────────────────────────────────
	const pageCount = isServerMode ? Math.max(1, Math.ceil((serverTotalCount ?? 0) / (serverPageSize ?? pagination.pageSize))) : undefined;
	const resolvedGetRowId = useCallback(
		(row: TData, index: number): string => {
			if (isServerPagination(resolvedPagination)) {
				return resolvedPagination.getRowId(row);
			}
			if (resolvedPagination.getRowId !== undefined) {
				return resolvedPagination.getRowId(row);
			}
			return String(index);
		},
		[resolvedPagination],
	);

	// Mirror of `pagination` for the manual-mode notification callback. The
	// handler below is memoized with a stable identity (it feeds TanStack's
	// `onPaginationChange`), so an updater-function must resolve its next state
	// against a ref rather than a stale closure. Written in an effect — refs
	// cannot be mutated during render under React 19.
	const paginationRef = useRef<PaginationState>(pagination);
	useEffect((): void => {
		paginationRef.current = pagination;
	}, [pagination]);

	const readPaginationState = useCallback((): PaginationState => paginationRef.current, []);

	// Sorting is loaded from persisted prefs, so writes go through this
	// handler to keep the round-trip symmetric (persistKey is opt-in).
	const handleSortingChange = useCallback(
		(updater: SortingState | ((prev: SortingState) => SortingState)): void => {
			const next = applyTableUpdater(updater, sorting);
			setSorting(next);
			setScrollTop(0);
			if (!isServerMode) {
				persistPreferences({ sorting: next });
			}
			if (isServerMode) {
				onManualSortingChange?.(next);
			}
		},
		[isServerMode, sorting, persistPreferences, onManualSortingChange],
	);

	// Pagination also invalidates the virtual scroll offset (same reason).
	const handlePaginationChange = useCallback(
		(updater: PaginationState | ((prev: PaginationState) => PaginationState)): void => {
			const current: PaginationState = readPaginationState();
			const next: PaginationState = applyTableUpdater(updater, current);
			if (isServerMode) {
				if (next.pageSize !== current.pageSize) {
					setPagination(next);
					setScrollTop(0);
					serverPagination?.onPageChange(0, next.pageSize);
				}
				return;
			}
			setPagination(next);
			setScrollTop(0);
		},
		[isServerMode, readPaginationState, serverPagination],
	);

	// Pinning changes flow through this handler so persistence mirrors the
	// sorting/visibility pattern (v9's `table.state` is intentionally opaque).
	const handlePinningChange = useCallback(
		(updater: ColumnPinningState | ((prev: ColumnPinningState) => ColumnPinningState)): void => {
			const next = applyTableUpdater(updater, columnPinning);
			setColumnPinning(next);
			persistPreferences({ columnPinning: next });
		},
		[columnPinning, persistPreferences],
	);

	const effectivePageSizeState = isServerMode ? (serverPageSize ?? pagination.pageSize) : pagination.pageSize;

	// The options object is memoized so the `table` wrapper keeps a stable
	// identity between state changes — that is what lets the memoized leaf
	// sub-components (rows, headers, menus, pager) skip re-rendering.
	const tableOptions = useMemo<TableOptions<DataTableFeatures, TData>>(
		() => ({
			features: dataTableFeatures,
			data,
			columns,
			getRowId: resolvedGetRowId,
			state: {
				sorting: controlledSorting ?? sorting,
				columnFilters,
				globalFilter,
				pagination: {
					pageIndex: isServerMode ? 0 : pagination.pageIndex,
					pageSize: effectivePageSizeState,
				},
				columnVisibility,
				columnPinning,
			},
			onSortingChange: handleSortingChange,
			onColumnFiltersChange: setColumnFilters,
			onGlobalFilterChange: setGlobalFilter,
			onPaginationChange: handlePaginationChange,
			onColumnVisibilityChange: setColumnVisibility,
			onColumnPinningChange: handlePinningChange,
			enableRowSelection: resolvedEnableBulkSelection,
			enableColumnPinning,
			manualPagination: isServerMode,
			manualSorting: isServerMode,
			manualFiltering: isServerMode,
			// TanStack declares `pageCount?: number` exactly — omit it in client mode.
			...(pageCount === undefined ? {} : { pageCount }),
			globalFilterFn: (row, _columnId, filterValue): boolean => {
				if (!searchKeys.length) return true;
				const filterParsed = DataTableCellScalarSchema.safeParse(filterValue);
				const filterText = filterParsed.success ? String(filterParsed.data).toLowerCase() : "";
				return searchKeys.some((key) => {
					const valueParsed = DataTableCellValueSchema.safeParse(row.getValue(key));
					const valueText = valueParsed.success ? toDataTableCellString(valueParsed.data).toLowerCase() : "";
					return valueText.includes(filterText);
				});
			},
		}),
		[
			data,
			columns,
			resolvedGetRowId,
			sorting,
			controlledSorting,
			columnFilters,
			globalFilter,
			pagination.pageIndex,
			effectivePageSizeState,
			columnVisibility,
			columnPinning,
			handleSortingChange,
			handlePaginationChange,
			handlePinningChange,
			resolvedEnableBulkSelection,
			enableColumnPinning,
			isServerMode,
			pageCount,
			searchKeys,
		],
	);

	// Granular selector (#6): subscribe ONLY to the slices the toolbar, pager and
	// rows read directly. `rowSelection` is deliberately excluded — the bulk
	// bars, header box and row checkboxes opt back in through `table.Subscribe`
	// below, so toggling a row never re-renders the toolbar (search, filters,
	// export, columns) or the pager.
	// v9 stores opaque values in `globalFilter`; coerce through Zod to keep projections typed.
	const table = useTable(tableOptions, (state) => {
		const globalFilterParsed = DataTableCellScalarSchema.safeParse(state.globalFilter);
		return {
			columnFilters: state.columnFilters,
			globalFilter: globalFilterParsed.success ? String(globalFilterParsed.data) : "",
			pagination: state.pagination,
			sorting: state.sorting,
			columnVisibility: state.columnVisibility,
			columnPinning: state.columnPinning,
		};
	});

	useEffect((): (() => void) => {
		if (!isServerMode) {
			return (): void => undefined;
		}
		table.resetRowSelection();
		const frame = globalThis.requestAnimationFrame((): void => {
			setSelectAllPages(false);
		});
		return (): void => {
			globalThis.cancelAnimationFrame(frame);
		};
	}, [controlledPageIndex, serverResetKey, serverPageSize, data, isServerMode, table, setSelectAllPages]);

	// Keep React pagination state aligned with parent-controlled server pager props.
	// Controlled page index and page size are merged into `tableOptions.state.pagination` below.

	// Sync the table's internal sorting state with the controlled sorting prop.
	useEffect((): void => {
		if (controlledSorting !== undefined) {
			const currentSorting = table.state.sorting;
			const isDifferent =
				currentSorting.length !== controlledSorting.length ||
				currentSorting.some((s, i) => {
					const controlled = controlledSorting.at(i);
					if (controlled === undefined) {
						return true;
					}
					return s.id !== controlled.id || s.desc !== controlled.desc;
				});
			if (isDifferent) {
				table.setSorting(controlledSorting);
			}
		}
	}, [controlledSorting, table]);

	const handleFilterChange = useCallback(
		(filterKey: string, value: string | null): void => {
			setScrollTop(0);
			if (isServerMode) {
				// A server-side filter is a query parameter, not a column: the caller refetches.
				if (onManualColumnFilterChange === undefined) {
					return;
				}
				onManualColumnFilterChange(filterKey, value);
				table.resetRowSelection();
				setSelectAllPages(false);
				if (serverPagination !== null) {
					serverPagination.onPageChange(0, serverPageSize ?? pagination.pageSize);
				}
				return;
			}
			if (value === "all" || value === null) {
				table.getColumn(filterKey)?.setFilterValue(undefined);
			} else {
				table.getColumn(filterKey)?.setFilterValue(value);
			}
		},
		[isServerMode, onManualColumnFilterChange, pagination.pageSize, serverPageSize, serverPagination, table, setSelectAllPages],
	);

	const getFilterValue = useCallback(
		(filterKey: string): string => {
			if (isServerMode) {
				return manualColumnFilters?.[filterKey] ?? "all";
			}
			const filterValue = table.getColumn(filterKey)?.getFilterValue();
			const parsed = DataTableCellScalarSchema.safeParse(filterValue);
			return parsed.success ? String(parsed.data) : "all";
		},
		[isServerMode, manualColumnFilters, table],
	);

	const showColumnFilters = filters.length > 0 && (!isServerMode || onManualColumnFilterChange !== undefined);

	// ── Pinning handlers ───────────────────────────────────────────────
	const togglePin = useCallback(
		(columnId: string): void => {
			const col = table.getColumn(columnId);
			if (!col?.getCanPin()) return;
			const current = col.getIsPinned();
			if (current === "start") {
				col.pin("end");
			} else if (current === "end") {
				col.pin(false);
			} else {
				col.pin("start");
			}
		},
		[table],
	);

	// ── Computed values (memoized — `table` identity is stable between
	//    state changes, so these only recompute when their inputs change) ─
	// NOTE: everything derived from `rowSelection` intentionally lives inside
	// the `table.Subscribe` island below (bulk bars + select-all banner) — the
	// parent does not subscribe to `rowSelection`, so those values would be
	// stale here. Only filter/sort/pagination-derived values live at this level.
	const isEmptyData = !isServerMode && data.length === 0 && !serverIsFiltered;
	const isServerEmptyPage = isServerMode && data.length === 0 && !serverIsFiltered;
	const filteredRowCount = table.getFilteredRowModel().rows.length;
	const isEmptyFiltered = filteredRowCount === 0 && !isEmptyData && !isServerEmptyPage;

	const pagerRowCount = isServerMode ? data.length : filteredRowCount;
	const showPager = isServerMode ? (serverTotalCount ?? 0) > 0 || controlledPageIndex > 0 || data.length > 0 : pagerRowCount > 0;

	const totalFilteredRows = filteredRowCount;

	const effectivePageSize: number = table.state.pagination.pageSize;
	const usePagePager: boolean = isServerMode;
	const effectiveTotalPages: number = usePagePager ? Math.max(1, Math.ceil((serverTotalCount ?? 0) / effectivePageSize)) : table.getPageCount();
	const canPreviousPage: boolean = usePagePager ? controlledPageIndex > 0 : table.state.pagination.pageIndex > 0;
	const canNextPage: boolean = usePagePager
		? controlledPageIndex < effectiveTotalPages - 1
		: table.state.pagination.pageIndex < Math.max(Math.ceil(filteredRowCount / effectivePageSize) - 1, 0);
	const manualRangeFrom: number = serverTotalCount === undefined || serverTotalCount === 0 ? 0 : controlledPageIndex * effectivePageSize + 1;
	const manualRangeTo: number = serverTotalCount === undefined ? table.getRowModel().rows.length : Math.min((controlledPageIndex + 1) * effectivePageSize, serverTotalCount);

	// ── Drag-and-drop handlers (NEW FEATURE 8) ─────────────────────────
	const handleDragStart = useCallback((e: React.DragEvent, index: number): void => {
		setDragIndex(index);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(index));
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent, index: number): void => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverIndex(index);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent, dropIndex: number): void => {
			e.preventDefault();
			const fromIndex = Number(e.dataTransfer.getData("text/plain"));
			if (!Number.isNaN(fromIndex) && fromIndex !== dropIndex && onRowReorder) {
				onRowReorder(
					fromIndex,
					dropIndex,
					table.getRowModel().rows.map((row) => row.original),
				);
			}
			setDragIndex(null);
			setDragOverIndex(null);
		},
		[onRowReorder, table],
	);

	const handleDragEnd = useCallback((): void => {
		setDragIndex(null);
		setDragOverIndex(null);
	}, []);

	// ── Inline editing handlers (NEW FEATURE 7) ────────────────────────
	const handleCellDoubleClick = useCallback(
		(rowIndex: number, columnId: string): void => {
			if (!editable || !editableSet.has(columnId)) return;
			setEditingCell({ rowIndex, columnId });
		},
		[editable, editableSet],
	);

	const handleCellEditSave = useCallback(
		(rowIndex: number, columnId: string, value: string, row: TData): void => {
			onCellEdit?.(rowIndex, columnId, value, row);
			setEditingCell(null);
		},
		[onCellEdit],
	);

	const handleCellEditCancel = useCallback((): void => {
		setEditingCell(null);
	}, []);

	// ── Toolbar handlers ───────────────────────────────────────────────
	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>): void => {
			const value = e.target.value;
			setSearchInput(value);
			setScrollTop(0);
			if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
			if (searchDebounceMs <= 0) {
				setGlobalFilter(value);
				return;
			}
			searchTimerRef.current = setTimeout(() => {
				setGlobalFilter(value);
			}, searchDebounceMs);
		},
		[searchDebounceMs],
	);

	/** Clears the search box and any pending debounced search. */
	const handleClearSearch = useCallback((): void => {
		setSearchInput("");
		setScrollTop(0);
		if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
		setGlobalFilter("");
	}, []);

	const handleClearFilters = useCallback((): void => {
		handleClearSearch();
		if (isServerMode) {
			onClearServerFilters?.();
			return;
		}
		table.resetColumnFilters();
	}, [handleClearSearch, isServerMode, onClearServerFilters, table]);

	const handleSelectAllPages = useCallback((): void => {
		setSelectAllPages(true);
	}, [setSelectAllPages]);

	const handleBulkActionDone = useCallback((): void => {
		table.resetRowSelection();
		setSelectAllPages(false);
	}, [table, setSelectAllPages]);

	const handleClearSelection = useCallback((): void => {
		table.resetRowSelection();
		setSelectAllPages(false);
	}, [table, setSelectAllPages]);

	const handlePageSizeChange = useCallback(
		(size: number): void => {
			setScrollTop(0);
			if (isServerMode) {
				setPagination((prev) => ({ ...prev, pageSize: size }));
				serverPagination?.onPageChange(0, size);
			} else {
				handlePaginationChange(() => ({ pageIndex: 0, pageSize: size }));
			}
			if (!isServerMode) {
				persistPreferences({ pageSize: size });
			}
		},
		[handlePaginationChange, isServerMode, persistPreferences, serverPagination],
	);

	const handleManualPageChange = useCallback(
		(nextPageIndex: number): void => {
			if (!usePagePager) {
				return;
			}
			setScrollTop(0);
			serverPagination?.onPageChange(nextPageIndex, effectivePageSize);
		},
		[effectivePageSize, serverPagination, usePagePager],
	);

	/**
	 * Moves to the page `resolve` picks from the current page index and the
	 * last page index; `undefined` means "stay". Server mode asks the server
	 * for the page; client mode updates local pagination state and keeps the
	 * same state object when the page does not change.
	 */
	const goToPage = useCallback(
		(resolve: (pageIndex: number, lastPageIndex: number) => number | undefined): void => {
			if (isServerMode) {
				const nextPageIndex = resolve(controlledPageIndex, effectiveTotalPages - 1);
				if (nextPageIndex !== undefined) {
					handleManualPageChange(nextPageIndex);
				}
				return;
			}
			setScrollTop(0);
			handlePaginationChange((prev) => {
				const nextPageIndex = resolve(prev.pageIndex, Math.max(Math.ceil(filteredRowCount / prev.pageSize) - 1, 0));
				return nextPageIndex === undefined || nextPageIndex === prev.pageIndex ? prev : { ...prev, pageIndex: nextPageIndex };
			});
		},
		[controlledPageIndex, effectiveTotalPages, filteredRowCount, handleManualPageChange, handlePaginationChange, isServerMode],
	);

	const handleFirstPage = useCallback((): void => {
		goToPage((pageIndex) => (pageIndex <= 0 ? undefined : 0));
	}, [goToPage]);

	const handlePreviousPage = useCallback((): void => {
		goToPage((pageIndex) => (pageIndex <= 0 ? undefined : pageIndex - 1));
	}, [goToPage]);

	const handleNextPage = useCallback((): void => {
		goToPage((pageIndex, lastPageIndex) => (pageIndex >= lastPageIndex ? undefined : pageIndex + 1));
	}, [goToPage]);

	const handleLastPage = useCallback((): void => {
		goToPage((pageIndex, lastPageIndex) => (pageIndex >= lastPageIndex ? undefined : lastPageIndex));
	}, [goToPage]);

	const handlePageSelect = useCallback(
		(pageNumber: number): void => {
			const targetIndex = pageNumber - 1;
			// Server mode passes the page through unclamped: the server owns the page range.
			goToPage((_pageIndex, lastPageIndex) => (isServerMode ? targetIndex : Math.min(Math.max(targetIndex, 0), lastPageIndex)));
		},
		[goToPage, isServerMode],
	);

	const handleTableDragOver = useCallback(
		(e: React.DragEvent): void => {
			if (draggable) e.preventDefault();
		},
		[draggable],
	);

	const handleVirtualScroll = useCallback((e: React.UIEvent<HTMLDivElement>): void => {
		setScrollTop(e.currentTarget.scrollTop);
	}, []);

	// ── Row virtualization band (opt-in — keeps large tables cheap) ─────
	const effectiveRowHeight = virtualRowHeight ?? DEFAULT_ROW_HEIGHT;
	const rowCount = table.getRowModel().rows.length;
	const virtualStart = virtualizeRows ? Math.max(0, Math.floor(scrollTop / effectiveRowHeight) - VIRTUAL_OVERSCAN) : 0;
	const virtualEnd = virtualizeRows
		? Math.min(rowCount, virtualStart + Math.ceil((maxHeight ?? DEFAULT_ROW_HEIGHT * 8) / effectiveRowHeight) + VIRTUAL_OVERSCAN * 2)
		: rowCount;
	const visibleRows = useMemo(
		() => (virtualizeRows ? table.getRowModel().rows.slice(virtualStart, virtualEnd) : table.getRowModel().rows),
		[virtualizeRows, virtualStart, virtualEnd, table],
	);

	const handleVisibilityChange = useCallback(
		(visibility: ColumnVisibilityState): void => {
			persistPreferences({ columnVisibility: visibility });
		},
		[persistPreferences],
	);

	// ── Selection-derived UI (bulk bars + select-all banner) ────────────
	// This render function is invoked from INSIDE a `<Subscribe>` on the
	// `rowSelection` atom, so it recomputes only when the selection slice
	// changes (plus when the parent re-renders). The parent itself never reads
	// selection state — that is what keeps the toolbar light (#6).
	const renderSelectionUi = useCallback((): React.JSX.Element => {
		const selectedRows = selectAllPages ? table.getFilteredRowModel().rows : table.getFilteredSelectedRowModel().rows;
		const selectedData = selectedRows.map((row) => row.original);
		const pageRowCount = table.getRowModel().rows.length;
		const clientFilteredRowCount = table.getFilteredRowModel().rows.length;
		const effectiveTotalFiltered = isServerMode ? (serverTotalCount ?? clientFilteredRowCount) : clientFilteredRowCount;
		const selectionContext: DataTableBulkSelectionContext = {
			selectAllPages,
			totalMatchingRows: selectAllPages ? effectiveTotalFiltered : selectedData.length,
		};
		const hasSelection = selectAllPages || selectedData.length > 0;
		const allPageRowsSelected = table.getIsAllPageRowsSelected();
		const showSelectAllBanner =
			resolvedEnableBulkSelection && allPageRowsSelected && !selectAllPages && effectiveTotalFiltered > pageRowCount && (!isServerMode || onFetchAllMatching !== undefined);
		// The desktop and mobile bars render the same bar from the same props.
		const bulkSelectionBarProps: BulkSelectionBarProps<TData> = {
			table,
			bulkActions: resolvedBulkActions,
			selectedRows: selectedData,
			selectionContext,
			selectAllPages,
			totalFilteredRows: effectiveTotalFiltered,
			labels,
			onAnyDeselect: handleAnyDeselect,
			onBulkActionDone: handleBulkActionDone,
			onClearSelection: handleClearSelection,
		};

		return (
			<>
				{/* ── SELECT ALL BANNER ─────────────────────────────────── */}
				{showSelectAllBanner ? (
					<div className={bulkSelectionSurfaceClasses}>
						<p className="text-sm text-muted-foreground">
							{formatDataTableLabel(labels.selectAllPageRowsSelected, { pageCount: table.getRowModel().rows.length })}{" "}
							<Button
								type="button"
								variant="link"
								size="sm"
								onClick={handleSelectAllPages}
								className="h-auto p-0 font-medium text-foreground underline-offset-4 hover:underline">
								{formatDataTableLabel(labels.selectAllFilteredRows, { totalCount: effectiveTotalFiltered })}
							</Button>
						</p>
					</div>
				) : null}

				{/* ── BULK ACTIONS BAR (desktop) ────────────────────────── */}
				{hasSelection && resolvedEnableBulkSelection ? (
					<div className="hidden lg:block">
						<BulkSelectionBar {...bulkSelectionBarProps} />
					</div>
				) : null}

				{/* ── MOBILE SELECTION BAR ──────────────────────────────── */}
				{resolvedEnableBulkSelection && mobileCardRender ? (
					<div className="lg:hidden">
						{hasSelection ? (
							<BulkSelectionBar {...bulkSelectionBarProps} />
						) : (
							<MobileSelectionBar
								table={table}
								selectedCount={selectedData.length}
								labels={labels}
								onAnyDeselect={handleAnyDeselect}
								onClearSelection={handleClearSelection}
							/>
						)}
					</div>
				) : null}
			</>
		);
	}, [
		selectAllPages,
		table,
		resolvedBulkActions,
		resolvedEnableBulkSelection,
		isServerMode,
		onFetchAllMatching,
		serverTotalCount,
		mobileCardRender,
		labels,
		handleAnyDeselect,
		handleBulkActionDone,
		handleClearSelection,
		handleSelectAllPages,
	]);

	// Facets count the rows the table holds, so they exist only client-side: a server page is
	// one slice of the results, and its filters are query parameters with no column behind them.
	const filterFacetedCounts = useMemo((): Record<string, ReadonlyMap<string, number>> => {
		const counts: Record<string, ReadonlyMap<string, number>> = {};
		if (isServerMode) {
			return counts;
		}
		for (const filter of filters) {
			const facetedRaw = table.getColumn(filter.key)?.getFacetedUniqueValues();
			counts[filter.key] = normalizeFacetedUniqueValues(facetedRaw ?? undefined);
		}
		return counts;
	}, [filters, isServerMode, table]);

	const desktopTableScrollStyle = useMemo((): React.CSSProperties | undefined => {
		if (!virtualizeRows) {
			return undefined;
		}
		return { maxHeight: maxHeight ?? DEFAULT_ROW_HEIGHT * 8 };
	}, [virtualizeRows, maxHeight]);

	const virtualTopSpacerStyle = useMemo((): React.CSSProperties => ({ height: virtualStart * effectiveRowHeight }), [virtualStart, effectiveRowHeight]);

	const virtualBottomSpacerStyle = useMemo((): React.CSSProperties => ({ height: (rowCount - virtualEnd) * effectiveRowHeight }), [rowCount, virtualEnd, effectiveRowHeight]);

	const shellState: DataTableShellState = error !== undefined && error !== null && error !== "" ? "error" : isLoading ? "loading" : "default";

	// ── Render ─────────────────────────────────────────────────────────
	return (
		<DataTableShell ref={ref} className={className} state={shellState}>
			{(title ?? description) ? (
				<CardHeader>
					{title ? <CardTitle>{title}</CardTitle> : null}
					{description ? <CardDescription>{description}</CardDescription> : null}
				</CardHeader>
			) : null}
			<CardContent>
				{/* ── SELECTION UI (bulk bars + select-all banner) ────────────
				    Subscribed to the `rowSelection` atom only (#6 granular
				    selectors): toggling a row re-renders just this island — the
				    toolbar, pager and row list below do not re-render. */}
				<Subscribe source={table.atoms.rowSelection}>{renderSelectionUi}</Subscribe>

				{/* ── TOOLBAR: Search, Filters, Column Toggle, Export ───── */}
				{searchKeys.length > 0 || showColumnFilters || toolbarContent !== undefined || enableColumnVisibility || resolvedExportable ? (
					<div
						data-slot="data-table-toolbar"
						data-layout={toolbarLayout}
						// `fill`: from `sm` a grid of equal columns, one per control (the search, then each filter). A grid,
						// not `flex-1`: a flex item starts from its own padding, so the padded filter buttons came out wider
						// than the search. On phones the toolbar stays a flex column, where the template does nothing.
						className={cn("mb-3 flex flex-col gap-2", toolbarLayout === "fill" ? "sm:grid sm:items-start" : "sm:flex-row sm:items-start")}
						style={
							toolbarLayout === "fill"
								? { gridTemplateColumns: `repeat(${String((searchKeys.length > 0 && !isServerMode ? 1 : 0) + (showColumnFilters ? filters.length : 0))}, minmax(0, 1fr))` }
								: undefined
						}>
						{/* Search (with clear button + live result count) */}
						{searchKeys.length > 0 && !isServerMode ? (
							<div className={cn("relative flex-1", toolbarLayout === "fill" ? "sm:min-w-0" : "sm:w-64 sm:flex-none")}>
								<Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									aria-label={labels.searchAriaLabel}
									placeholder={labels.searchPlaceholder}
									value={searchInput}
									onChange={handleSearchChange}
									className="h-9 pr-8 pl-8 text-sm"
								/>
								{searchInput !== "" ? (
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										onClick={handleClearSearch}
										aria-label={labels.clearSearchAriaLabel}
										className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
										<X className="h-4 w-4" />
									</Button>
								) : null}
							</div>
						) : null}

						{/* Column filters (with faceted counts on client-side tables). Stacked on phones; from `sm` they
						    wrap onto further lines when there are more than fit, so every filter stays visible: no
						    sideways scrolling, no scrollbar, never clipped by the card around the table. They share the toolbar's row with
						    the search and buttons (which stay on its first line), taking the space left over, but never less than their
						    widest select (`min-w-min`): with `min-w-0`, wide neighbours squeezed them to nothing and they spilled over the
						    search. */}
						{showColumnFilters ? (
							<div
								data-slot="data-table-filters"
								// `fill`: the wrapper steps out of the layout (`contents`), so every filter is its own grid column.
								className={cn(
									"flex flex-col gap-2",
									toolbarLayout === "fill" ? "sm:contents" : "sm:min-w-min sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:*:shrink-0",
								)}>
								{filters.map((filter) => (
									<ColumnFilterSelect
										key={filter.key}
										filter={filter}
										value={getFilterValue(filter.key)}
										showCounts={!isServerMode}
										totalFilteredRows={totalFilteredRows}
										facetedCounts={isServerMode ? EMPTY_FACETED_COUNTS : (filterFacetedCounts[filter.key] ?? EMPTY_FACETED_COUNTS)}
										onFilterChange={handleFilterChange}
										fillWidth={toolbarLayout === "fill"}
									/>
								))}
							</div>
						) : null}

						{/* Custom toolbar content */}
						{toolbarContent}

						{/* Live result count (search or a column filter is active) */}
						{!isServerMode && (searchInput !== "" || columnFilters.length > 0) ? (
							<span className="text-xs whitespace-nowrap text-muted-foreground">
								{formatDataTableLabel(labels.resultsCount, { filtered: totalFilteredRows, total: data.length })}
							</span>
						) : null}

						{resolvedExportable || enableColumnVisibility ? (
							<div className="mt-1 flex items-center gap-2 sm:mt-0 sm:ml-auto">
								{resolvedExportable ? (
									<ExportMenu
										table={table}
										columns={columns}
										exportFilename={resolvedExportFilename}
										exportableColumns={resolvedExportableColumns}
										exportFormats={resolvedExportFormats}
										labels={labels}
										isServerMode={isServerMode}
										onFetchAllMatching={onFetchAllMatching}
									/>
								) : null}

								{enableColumnVisibility ? (
									<ColumnVisibilityMenu table={table} columnVisibility={columnVisibility} onVisibilityChange={handleVisibilityChange} labels={labels} />
								) : null}
							</div>
						) : null}
					</div>
				) : null}

				{/* ── MAIN CONTENT ────────────────────────────────────────── */}
				{error !== undefined && error !== null && error !== "" ? (
					<div role="alert" className="my-8 flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-8 text-center">
						<CircleAlert className="h-6 w-6 text-destructive" />
						<p className="text-sm font-medium text-destructive">{error}</p>
					</div>
				) : isLoading ? (
					<div role="status" aria-busy="true" aria-label={labels.loadingTableAriaLabel} className="hidden overflow-x-auto rounded-md border lg:block">
						<Table>
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id} className="h-11 bg-muted/30 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
												{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{Array.from({ length: Math.max(0, skeletonRows) }, (_, index) => (
									<SkeletonRow key={index} cells={columns.length} height={virtualizeRows ? effectiveRowHeight : undefined} />
								))}
							</TableBody>
						</Table>
					</div>
				) : isEmptyData || isServerEmptyPage ? (
					<Empty className="my-12">
						<EmptyHeader>
							<EmptyMedia variant="icon">{emptyState?.icon ?? <Search className="h-6 w-6" />}</EmptyMedia>
							<EmptyTitle>{emptyState?.title ?? labels.noDataTitle}</EmptyTitle>
							<EmptyDescription>{emptyState?.description ?? labels.noDataDescription}</EmptyDescription>
						</EmptyHeader>
						{emptyState?.action ? (
							<EmptyContent>
								<Button onClick={emptyState.action.onClick}>{emptyState.action.label}</Button>
							</EmptyContent>
						) : null}
					</Empty>
				) : (
					<>
						{/* ── MOBILE CARD VIEW ────────────────────────────── */}
						{mobileCardRender && !isDesktopViewport ? (
							<div className={cn("space-y-4 transition-opacity duration-150", isRefetching && "opacity-60")}>
								{isEmptyFiltered ? (
									<NoResults labels={labels} onClearFilters={handleClearFilters} />
								) : (
									table
										.getRowModel()
										.rows.map((row) => (
											<MobileCardView
												key={row.id}
												row={row}
												table={table}
												enableBulkSelection={resolvedEnableBulkSelection}
												mobileCardRender={mobileCardRender}
												actions={actions}
												labels={labels}
												onAnyDeselect={handleAnyDeselect}
												onRowClick={onRowClick}
											/>
										))
								)}
							</div>
						) : null}

						{/* ── DESKTOP TABLE VIEW (virtualized when opt-in) ── */}
						{isDesktopViewport || !mobileCardRender ? (
							<div
								className={cn(
									mobileCardRender ? "rounded-md border" : "hidden rounded-md border lg:block",
									virtualizeRows ? "overflow-auto" : "overflow-x-auto",
									"transition-opacity duration-150",
									isRefetching && "opacity-60",
								)}
								style={desktopTableScrollStyle}
								onScroll={virtualizeRows ? handleVirtualScroll : undefined}>
								<Table>
									<TableHeader>
										{table.getHeaderGroups().map((headerGroup) => (
											<TableRow key={headerGroup.id}>
												{headerGroup.headers.map((header) => (
													<HeaderCell
														key={header.id}
														header={header}
														enableColumnPinning={enableColumnPinning}
														sortCycle={sortCycle}
														onTogglePin={togglePin}
														labels={labels}
													/>
												))}
											</TableRow>
										))}
									</TableHeader>
									<TableBody onDragOver={draggable ? handleTableDragOver : undefined}>
										{table.getRowModel().rows.length ? (
											<>
												{virtualizeRows && virtualStart > 0 ? <tr aria-hidden="true" style={virtualTopSpacerStyle} /> : null}
												{visibleRows.map((row, rowIdx) => {
													const rowIndex = virtualStart + rowIdx;
													const renderRow = (isRowSelected: boolean): React.JSX.Element => (
														<TableRowView
															key={row.id}
															row={row}
															rowIdx={rowIndex}
															rowHeight={virtualizeRows ? effectiveRowHeight : undefined}
															isRowSelected={isRowSelected}
															draggable={draggable}
															editableSet={editableSet}
															editingCell={editingCell}
															dragIndex={dragIndex}
															dragOverIndex={dragOverIndex}
															onRowClick={onRowClick}
															onDragStart={handleDragStart}
															onDragOver={handleDragOver}
															onDrop={handleDrop}
															onDragEnd={handleDragEnd}
															onCellDoubleClick={handleCellDoubleClick}
															onCellEditSave={handleCellEditSave}
															onCellEditCancel={handleCellEditCancel}
														/>
													);

													// Per-row granular subscription: the memoized row re-renders only
													// when THIS row's selection flips (row objects are cached by the
													// row model, so `row.getIsSelected()` would otherwise go stale).
													const isRowSelected = rowSelectionSelector(row.id);
													return (
														<Subscribe key={row.id} source={table.atoms.rowSelection} selector={isRowSelected}>
															{renderRow}
														</Subscribe>
													);
												})}
												{virtualizeRows && virtualEnd < rowCount ? <tr aria-hidden="true" style={virtualBottomSpacerStyle} /> : null}
											</>
										) : (
											<TableRow>
												<TableCell colSpan={columns.length} className="h-64">
													<NoResults labels={labels} onClearFilters={handleClearFilters} />
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
						) : null}

						{/* ── PAGINATION ── */}
						{showPager ? (
							<div className="flex flex-col items-center justify-center gap-6 py-6 sm:flex-row md:justify-center lg:justify-between">
								<div className="flex items-center gap-4">
									<div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
										{isRefetching ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" /> : null}
										<span>
											{usePagePager
												? formatDataTableLabel(labels.showingResults, {
														from: manualRangeFrom,
														to: manualRangeTo,
														total: serverTotalCount ?? 0,
													})
												: formatDataTableLabel(labels.showingResults, {
														from: table.state.pagination.pageIndex * table.state.pagination.pageSize + 1,
														to: Math.min((table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize, filteredRowCount),
														total: filteredRowCount,
													})}
										</span>
										{usePagePager ? (
											<span className="text-sm text-muted-foreground">
												{formatDataTableLabel(labels.pageOfTotal, {
													page: controlledPageIndex + 1,
													totalPages: effectiveTotalPages,
												})}
											</span>
										) : null}
									</div>
								</div>
								<div className="flex items-center space-x-4">
									<div className="flex items-center gap-2">
										<span id={pageSizeShowId} className="text-sm text-muted-foreground">
											{labels.showPerPage}
										</span>
										<PageSizeSelect
											ariaLabelledBy={`${pageSizeShowId} ${pageSizePerPageId}`}
											pageSize={table.state.pagination.pageSize}
											options={finalPageSizeOptions}
											onPageSizeChange={handlePageSizeChange}
										/>
										<span id={pageSizePerPageId} className="text-sm text-muted-foreground">
											{labels.perPage}
										</span>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Button variant="outline" size="sm" onClick={handleFirstPage} disabled={!canPreviousPage} aria-label={labels.firstPageAriaLabel}>
										<ChevronsLeft className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!canPreviousPage} aria-label={labels.previousPageAriaLabel}>
										<ChevronLeft className="h-4 w-4" />
									</Button>{" "}
									{(!isServerMode && table.getPageCount() > 1) || (usePagePager && effectiveTotalPages > 1) ? (
										<div className="flex items-center gap-1">
											{Array.from({ length: Math.min(5, usePagePager ? effectiveTotalPages : table.getPageCount()) }, (_, i) => {
												let pageNumber: number;
												const currentPage = usePagePager ? controlledPageIndex + 1 : table.state.pagination.pageIndex + 1;
												const totalPages = usePagePager ? effectiveTotalPages : table.getPageCount();

												if (totalPages <= 5) {
													pageNumber = i + 1;
												} else if (currentPage <= 3) {
													pageNumber = i + 1;
												} else if (currentPage >= totalPages - 2) {
													pageNumber = totalPages - 4 + i;
												} else {
													pageNumber = currentPage - 2 + i;
												}

												return (
													<PageNumberButton
														key={pageNumber}
														pageNumber={pageNumber}
														currentPage={currentPage}
														onPageSelect={handlePageSelect}
														goToPageAriaLabel={labels.goToPageAriaLabel}
													/>
												);
											})}
										</div>
									) : null}
									<Button variant="outline" size="sm" onClick={handleNextPage} disabled={!canNextPage} aria-label={labels.nextPageAriaLabel}>
										<ChevronRight className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handleLastPage} disabled={!canNextPage} aria-label={labels.lastPageAriaLabel}>
										<ChevronsRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						) : null}
					</>
				)}
			</CardContent>
		</DataTableShell>
	);
}
