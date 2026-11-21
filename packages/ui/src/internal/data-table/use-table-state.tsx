"use client";

// DataTable's state: the ONE `useTable` call, the columns the table adds itself (drag grip, checkbox, detail toggle,
// pin, ⋯ menu), saved preferences, and the mapping between the table's state and where it lives: inside the
// component for a client or infinite table, in the parent's `query` object for a server one.

import { isStringPrimitive } from "@workspace/shared";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { createLocalStorageDataTableStorage } from "@workspace/ui/lib/table/storage";
import {
	DATA_TABLE_UTILITY_COLUMN_ID,
	DATA_TABLE_UTILITY_COLUMN_IDS,
	DEFAULT_DATA_TABLE_DENSITY,
	DataTableCellScalarSchema,
	DataTableDateRangeSchema,
	DataTableCellValueSchema,
	assertDataTableFiltersMatchColumns,
	assertUniqueDataTableColumnIds,
	displayStringFromTanStackValue,
	isDataTableQueryFiltered,
	isEmptyDataTableFilterValue,
	normalizeFacetedUniqueValues,
	parseDataTableCellValue,
	readDataTableRowField,
	reconcileDataTablePrefs,
	resolveDataTableColumnId,
	toDataTableCellString,
	withDataTableFilter,
	withDataTableFiltersCleared,
	withDataTablePage,
	withDataTablePageSize,
	withDataTableSearch,
	withDataTableSorting,
	type DataTableDensity,
	type DataTableFilterValue,
	type DataTableReorderRow,
	type DataTableLabels,
	type DataTablePersistedPrefs,
	type DataTablePersistedPrefsPatch,
	type DataTableStorageAdapter,
} from "@workspace/ui-kit-logic";
import {
	filterFn_equalsStringSensitive,
	flexRender,
	useTable,
	type CellContext,
	type CellData,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnPinningState,
	type ColumnSizingState,
	type ColumnVisibilityState,
	type ExpandedState,
	type HeaderContext,
	type PaginationState,
	type RowData,
	type SortingState,
	type TableOptions,
	type Updater,
} from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

import { tableEngineFeatures, type TableEngineColumnMeta, type TableEngineFeatures } from "../table-engine/table-engine";
import { TableEngineColumnHeader } from "../table-engine/table-engine-column-header";
import { TableEngineTableRowExpand, TableEngineTableRowPin, TableEngineTableRowSelect, TableEngineTableRowSelectAll } from "../table-engine/table-engine-table";
import { TableEngineTableDndRowHandle } from "../table-engine/table-engine-table-dnd-rows";
import { localDateRangeFilterFn, utcDateRangeFilterFn } from "./filter-date-range";
import { multiSelectFilterFn } from "./filter-multi-select";
import type {
	DataTableClientSource,
	DataTableColumns,
	DataTableFilter,
	DataTableFilterChangeHandler,
	DataTableProps,
	DataTableSelectionScope,
	DataTableServerSource,
	DataTableSource,
} from "./props";
import { RowActionsMenu, rowActionsColumnWidth } from "./row-actions-menu";
import { applyTableUpdater, type DataTableInstance } from "./shared";
import type { ToolbarSearch } from "./toolbar";

/** Rows per page when `paging` names none. */
const DEFAULT_PAGE_SIZE = 10;

/** The page sizes offered when `paging` names none. */
const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 50, 100];

/** Width of a column that holds one control (drag grip, checkbox, toggle, pin). */
const CONTROL_COLUMN_SIZE_PX = 44;

const CLIENT_SOURCE: DataTableClientSource = { mode: "client" };

/** What every column filters by unless it says otherwise: the exact option value. TanStack's "auto" would pick a substring match for text ("SUCCESS" keeping "PARTIAL_SUCCESS"). */
const SELECT_FILTER_COLUMN_DEFAULTS = { filterFn: filterFn_equalsStringSensitive };

/** The placeholder a loading cell draws, unless the column brings its own (`meta.skeleton`). */
const DEFAULT_CELL_SKELETON: React.ReactNode = <Skeleton variant="text" className="h-4 w-full" />;

/** A client-side filter's value, as the table's column filter state holds it. */
const ClientFilterValueSchema = z.union([z.string(), z.array(z.string()), DataTableDateRangeSchema]);

/**
 * One page that holds every row. Not `data.length`: an opened tree branch or detail row adds rows to the page beyond
 * the top-level ones, and a page sized by the top level would cut the last of them off.
 */
const UNPAGED: PaginationState = { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER };

/** Matches while the page is being printed (or shown in a print preview). */
const PRINT_MEDIA_QUERY = "print";

/** The columns the table adds itself (checkbox, grip, toggle, pin, row menu), all hidden: what a printed table leaves out. */
const PRINT_HIDDEN_COLUMNS: ColumnVisibilityState = Object.fromEntries(DATA_TABLE_UTILITY_COLUMN_IDS.map((id) => [id, false]));

const NO_UTILITY_OPTIONS = { enableSorting: false, enableHiding: false, enablePinning: false, enableResizing: false };

// ── Column preparation ─────────────────────────────────────────────────────

/** The header of a column declared with a plain string title: a label, a sort button or the column menu, per the table's controls. */
function AutoColumnHeader<TData extends RowData, TValue extends CellData>({ column }: HeaderContext<TableEngineFeatures, TData, TValue>): React.JSX.Element {
	// No column-visibility submenu here: the toolbar's "Columns" button owns that, so a header stays a one-click sort
	// button unless pinning or reordering gives it a real menu.
	return <TableEngineColumnHeader column={column} />;
}

function SelectAllHeader(): React.JSX.Element {
	return <TableEngineTableRowSelectAll />;
}

function SelectRowCell<TData extends RowData>({ row }: CellContext<TableEngineFeatures, TData>): React.JSX.Element {
	return <TableEngineTableRowSelect row={row} />;
}

function DetailToggleCell<TData extends RowData>({ row }: CellContext<TableEngineFeatures, TData>): React.JSX.Element {
	return <TableEngineTableRowExpand row={row} />;
}

function PinRowCell<TData extends RowData>({ row }: CellContext<TableEngineFeatures, TData>): React.JSX.Element {
	return <TableEngineTableRowPin row={row} />;
}

function DragHandleCell(): React.JSX.Element {
	return <TableEngineTableDndRowHandle />;
}

/** How the table filters a column that sits behind a toolbar filter with a filter function of its own. */
export type FilteredColumnKind = "multi-select" | "date-range-local" | "date-range-utc";

/** The columns behind such a filter, by column id. A `select` filter needs no entry: it uses the plain equality filter. */
export type FilteredColumns = ReadonlyMap<string, FilteredColumnKind>;

const FILTER_FNS = {
	"multi-select": multiSelectFilterFn,
	"date-range-local": localDateRangeFilterFn,
	"date-range-utc": utcDateRangeFilterFn,
} satisfies Record<FilteredColumnKind, typeof multiSelectFilterFn>;

/** The entry of one toolbar filter, or `null` for a `select` filter. */
function filteredColumnKind(filter: DataTableFilter): FilteredColumnKind | null {
	if (filter.kind === "multi-select") {
		return "multi-select";
	}
	if (filter.kind === "date-range") {
		return filter.zone === "utc" ? "date-range-utc" : "date-range-local";
	}
	return null;
}

/** Which columns a table's filters give a filter function to. */
export function readFilteredColumns(filters: readonly DataTableFilter[]): FilteredColumns {
	const filtered = new Map<string, FilteredColumnKind>();
	for (const filter of filters) {
		const kind = filteredColumnKind(filter);
		if (kind !== null) {
			filtered.set(filter.column, kind);
		}
	}
	return filtered;
}

/**
 * One caller column, made ready for the engine: a string `header` becomes the engine's column header (so it sorts and
 * opens the column menu), every cell gets a loading placeholder, and a column behind a multi-select filter filters by
 * "one of the chosen values". Group columns are walked; their own header stays as written.
 */
export function prepareColumn<TData extends RowData>(
	column: ColumnDef<TableEngineFeatures, TData>,
	filteredColumns: FilteredColumns,
	isEditing: boolean,
): ColumnDef<TableEngineFeatures, TData> {
	if ("columns" in column) {
		return { ...column, columns: column.columns.map((child) => prepareColumn(child, filteredColumns, isEditing)) };
	}
	const id = resolveDataTableColumnId(column);
	const filterKind = id === undefined || column.filterFn !== undefined ? undefined : filteredColumns.get(id);
	const filterFnOverride = filterKind === undefined ? {} : { filterFn: FILTER_FNS[filterKind] };
	const meta = prepareColumnMeta(column.meta, isEditing);
	if (!isStringPrimitive(column.header)) {
		return { ...column, ...filterFnOverride, meta };
	}
	// TanStack falls back to a string header for the column's id; the header is a component from here on, so the id
	// is written down.
	const title = column.header;
	return {
		...column,
		...filterFnOverride,
		id: id ?? title,
		header: AutoColumnHeader,
		meta: { ...meta, headerTitle: meta.headerTitle ?? title },
	};
}

/**
 * A column's `meta` with the table's defaults: a loading placeholder, and (on an editing table) the built-in text
 * editor for a column that declares `meta.cellEdit` without choosing a control.
 */
function prepareColumnMeta(meta: TableEngineColumnMeta | undefined, isEditing: boolean): TableEngineColumnMeta {
	const cellEdit = meta?.cellEdit;
	if (!isEditing || cellEdit === undefined || cellEdit.control !== undefined) {
		return { skeleton: DEFAULT_CELL_SKELETON, ...meta };
	}
	return { skeleton: DEFAULT_CELL_SKELETON, ...meta, cellEdit: { ...cellEdit, control: "text" } };
}

/** The first leaf column's cell, with the tree toggle (and the indent of the row's depth) in front of its content. */
function withTreeToggle<TData extends RowData>(column: ColumnDef<TableEngineFeatures, TData>, indent: number | undefined): ColumnDef<TableEngineFeatures, TData> {
	if ("columns" in column) {
		const [firstChild, ...otherChildren] = column.columns;
		return firstChild === undefined ? column : { ...column, columns: [withTreeToggle(firstChild, indent), ...otherChildren] };
	}
	const originalCell = column.cell;
	return {
		...column,
		cell: (context): React.JSX.Element => (
			<span className="flex min-w-0 items-center gap-1">
				<TableEngineTableRowExpand row={context.row} {...(indent === undefined ? {} : { indent })} />
				<span className="min-w-0">
					{originalCell === undefined ? displayStringFromTanStackValue(DataTableCellValueSchema.safeParse(context.getValue()).data) : flexRender(originalCell, context)}
				</span>
			</span>
		),
	};
}

// ── The hook ───────────────────────────────────────────────────────────────

/** Everything the DataTable component renders from. */
export interface DataTableController<TData extends RowData> {
	readonly table: DataTableInstance<TData>;
	/** The caller's columns plus the ones the table adds itself. */
	readonly columns: DataTableColumns<TData>;
	readonly mode: DataTableSource<TData>["mode"];
	readonly onFetchAllMatching: (() => Promise<TData[]>) | undefined;
	readonly search: ToolbarSearch | null;
	readonly filterValues: Readonly<Record<string, DataTableFilterValue>>;
	/** Rows per filter option, by filter column; `null` on a server table, which holds one page and cannot count. */
	readonly filterCounts: Readonly<Record<string, ReadonlyMap<string, number>>> | null;
	readonly onFilterChange: DataTableFilterChangeHandler;
	readonly onClearFilters: () => void;
	/** A search or a filter is narrowing the rows. */
	readonly isFiltered: boolean;
	/** Every row that matches the search and the filters, across all pages. */
	readonly matchingCount: number;
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly pageSizeOptions: readonly number[];
	readonly onPageChange: (pageIndex: number) => void;
	readonly onPageSizeChange: (pageSize: number) => void;
	readonly scope: DataTableSelectionScope;
	readonly onScopeChange: (scope: DataTableSelectionScope) => void;
	/** The rows on screen, in order, with their parents: what a row drag reorders. */
	readonly visibleRows: readonly DataTableReorderRow[];
	/** How much room each row takes: the reader's choice when the density control is on, otherwise `layout.density`. */
	readonly density: DataTableDensity;
	readonly onDensityChange: (density: DataTableDensity) => void;
	/** The page is being printed: every row the table holds is drawn, without the table's own control columns. */
	readonly isPrinting: boolean;
	/** The row whose details are open in the panel, or `null`. */
	readonly panelRowId: string | null;
	readonly onPanelRowChange: (rowId: string | null) => void;
	/** Moves the panel to the previous (`-1`) or next (`1`) row on screen; does nothing at either end. */
	readonly onPanelStep: (step: -1 | 1) => void;
}

function readServerSource<TData extends RowData>(source: DataTableSource<TData>): DataTableServerSource<TData> | null {
	return source.mode === "server" ? source : null;
}

export function useDataTableState<TData extends RowData>(props: DataTableProps<TData>, labels: DataTableLabels): DataTableController<TData> {
	const {
		data,
		columns: callerColumns,
		getRowId,
		search,
		filters,
		paging,
		rowActions,
		selection,
		tree,
		detail,
		rowReorder,
		rowPinning = false,
		columnControls,
		preferences,
	} = props;
	const source: DataTableSource<TData> = props.source ?? CLIENT_SOURCE;
	const serverSource = readServerSource(source);
	const isServer = serverSource !== null;
	const serverQuery = serverSource?.query;
	const onQueryChange = serverSource?.onQueryChange;
	const isPaged = isServer || paging !== undefined;
	const pageSizeOptions = paging?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
	const isSelectable = selection !== undefined;
	// A detail panel opens beside the table; only a detail ROW needs the expand toggle and expandable rows.
	const isDetailPanel = detail?.mode === "panel";
	const hasDetail = detail !== undefined && !isDetailPanel;
	const isReorderable = rowReorder !== undefined;
	const isEditing = props.editing !== undefined;

	// ── Saved preferences (read once, in the first render) ─────────────────
	const preferencesKey = preferences?.key;
	const preferencesStorage = preferences?.storage;
	const storage = React.useMemo((): DataTableStorageAdapter | null => {
		if (preferencesKey === undefined) {
			return null;
		}
		return preferencesStorage ?? createLocalStorageDataTableStorage();
	}, [preferencesKey, preferencesStorage]);

	const [savedPrefs] = React.useState<DataTablePersistedPrefs | null>(() => (preferencesKey === undefined || storage === null ? null : storage.read(preferencesKey)));

	const persist = React.useCallback(
		(patch: DataTablePersistedPrefsPatch): void => {
			if (preferencesKey !== undefined && storage !== null) {
				storage.write(preferencesKey, patch);
			}
		},
		[preferencesKey, storage],
	);

	// ── Columns ────────────────────────────────────────────────────────────
	const filteredColumns = React.useMemo((): FilteredColumns => readFilteredColumns(filters ?? []), [filters]);
	const detailRender = hasDetail ? detail.render : undefined;
	const treeIndent = tree?.indent;
	const hasTree = tree !== undefined;

	const columns = React.useMemo((): DataTableColumns<TData> => {
		const prepared = callerColumns.map((column) => prepareColumn(column, filteredColumns, isEditing));
		const [firstColumn, ...otherColumns] = prepared;
		const dataColumns = hasTree && firstColumn !== undefined ? [withTreeToggle(firstColumn, treeIndent), ...otherColumns] : prepared;
		const built: DataTableColumns<TData> = [];

		if (isReorderable) {
			built.push({ id: DATA_TABLE_UTILITY_COLUMN_ID.drag, header: "", cell: DragHandleCell, size: CONTROL_COLUMN_SIZE_PX, ...NO_UTILITY_OPTIONS });
		}
		if (isSelectable) {
			built.push({ id: DATA_TABLE_UTILITY_COLUMN_ID.select, header: SelectAllHeader, cell: SelectRowCell, size: CONTROL_COLUMN_SIZE_PX, ...NO_UTILITY_OPTIONS });
		}
		if (detailRender !== undefined) {
			built.push({
				id: DATA_TABLE_UTILITY_COLUMN_ID.expand,
				header: "",
				cell: DetailToggleCell,
				size: CONTROL_COLUMN_SIZE_PX,
				meta: { expandedContent: detailRender },
				...NO_UTILITY_OPTIONS,
			});
		}
		if (rowPinning) {
			built.push({ id: DATA_TABLE_UTILITY_COLUMN_ID.pin, header: "", cell: PinRowCell, size: CONTROL_COLUMN_SIZE_PX, ...NO_UTILITY_OPTIONS });
		}
		built.push(...dataColumns);
		if (rowActions !== undefined && rowActions.length > 0) {
			built.push({
				id: DATA_TABLE_UTILITY_COLUMN_ID.actions,
				header: (): React.JSX.Element => <span className="sr-only">{labels.actionsColumnHeader}</span>,
				cell: ({ row }): React.JSX.Element => <RowActionsMenu row={row.original} actions={rowActions} labels={labels} />,
				size: rowActionsColumnWidth(rowActions),
				meta: { headerTitle: labels.actionsColumnHeader },
				...NO_UTILITY_OPTIONS,
			});
		}

		// A caller's column must not reuse a built-in id or another column's id: React would key two cells per row alike.
		assertUniqueDataTableColumnIds(built);
		// A client-side filter filters a column, so each must name one; a server-side filter is a query key.
		if (!isServer) {
			assertDataTableFiltersMatchColumns(
				(filters ?? []).map((filter) => filter.column),
				built,
			);
		}
		return built;
	}, [callerColumns, filteredColumns, isEditing, hasTree, treeIndent, isReorderable, isSelectable, detailRender, rowPinning, rowActions, labels, isServer, filters]);

	const columnIds = React.useMemo(
		(): string[] => callerColumns.map((column) => resolveDataTableColumnId(column)).filter((id): id is string => id !== undefined),
		[callerColumns],
	);

	const reconciled = React.useMemo(
		() => reconcileDataTablePrefs({ prefs: savedPrefs, columnIds, pageSizeOptions, defaultPageSize: paging?.pageSize ?? DEFAULT_PAGE_SIZE, isServerMode: isServer }),
		[savedPrefs, columnIds, pageSizeOptions, paging?.pageSize, isServer],
	);

	// ── State the table owns (a server table reads the first four from `source.query` instead) ─
	const initialSorting = props.sorting?.initial;
	const [clientSorting, setClientSorting] = React.useState<SortingState>(() => (reconciled.sorting.length > 0 ? reconciled.sorting : [...(initialSorting ?? [])]));
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [clientPagination, setClientPagination] = React.useState<PaginationState>(() => ({ pageIndex: 0, pageSize: reconciled.pageSize }));
	const [chosenColumnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(() => reconciled.columnVisibility);
	// On paper the checkboxes, grips, toggles and row menus are noise, so the columns the table adds itself are left
	// out while printing. The reader's own choices are untouched and come back after it.
	const isPrinting = useMediaQuery(PRINT_MEDIA_QUERY);
	// The row whose details are open in the panel (`detail.mode: "panel"`), or `null`.
	const [panelRowId, setPanelRowId] = React.useState<string | null>(null);
	const panelHiddenColumns = isDetailPanel && panelRowId !== null ? detail.hideColumnsWhileOpen : undefined;
	const columnVisibility = React.useMemo((): ColumnVisibilityState => {
		// While the panel is open, the columns it asks for are hidden to make room; the reader's own choices stay as they are.
		const withPanel =
			panelHiddenColumns === undefined ? chosenColumnVisibility : { ...chosenColumnVisibility, ...Object.fromEntries(panelHiddenColumns.map((id) => [id, false])) };
		return isPrinting ? { ...withPanel, ...PRINT_HIDDEN_COLUMNS } : withPanel;
	}, [isPrinting, chosenColumnVisibility, panelHiddenColumns]);
	const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(() => reconciled.columnPinning);
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => reconciled.columnOrder);
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => reconciled.columnSizing);
	// The reader's density (saved, or picked in this visit). It counts only while the density control is on; a table
	// without the control always follows `layout.density`.
	const [chosenDensity, setChosenDensity] = React.useState<DataTableDensity | undefined>(() => reconciled.density);
	const layoutDensity = props.layout?.density ?? DEFAULT_DATA_TABLE_DENSITY;
	const density = columnControls?.density === true ? (chosenDensity ?? layoutDensity) : layoutDensity;
	const handleDensityChange = React.useCallback(
		(next: DataTableDensity): void => {
			setChosenDensity(next);
			persist({ density: next });
		},
		[persist],
	);

	const sorting = React.useMemo((): SortingState => (serverQuery === undefined ? clientSorting : [...serverQuery.sorting]), [serverQuery, clientSorting]);
	const serverPageIndex = serverQuery?.pageIndex;
	const serverPageSize = serverQuery?.pageSize;
	const pagination = React.useMemo((): PaginationState => {
		if (serverPageIndex !== undefined && serverPageSize !== undefined) {
			return { pageIndex: serverPageIndex, pageSize: serverPageSize };
		}
		// Without paging every row is one page. A printed table is not paged either: paper shows every row the table holds.
		if (!isPaged || isPrinting) {
			return UNPAGED;
		}
		// The caller can hand over fewer rows at any time (a filter of its own above the table). The page then stays
		// inside what is left, so a reader on page 4 of a list that shrank to two pages sees the last page, not an
		// empty one.
		const lastPageIndex = Math.max(Math.ceil(data.length / clientPagination.pageSize) - 1, 0);
		return clientPagination.pageIndex > lastPageIndex ? { ...clientPagination, pageIndex: lastPageIndex } : clientPagination;
	}, [serverPageIndex, serverPageSize, isPaged, isPrinting, clientPagination, data.length]);

	// ── Search (the input is immediate; what filters the rows waits for the debounce) ─
	const externalSearch = serverQuery?.search;
	const [searchInput, setSearchInput] = React.useState(externalSearch ?? "");
	const [syncedExternalSearch, setSyncedExternalSearch] = React.useState(externalSearch);
	if (externalSearch !== syncedExternalSearch) {
		// The parent changed the query's search itself (for example "clear filters"): the box follows.
		setSyncedExternalSearch(externalSearch);
		setSearchInput(externalSearch ?? "");
	}
	const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	React.useEffect(
		(): (() => void) => (): void => {
			if (searchTimerRef.current !== null) {
				clearTimeout(searchTimerRef.current);
			}
		},
		[],
	);

	const applySearch = React.useCallback(
		(value: string): void => {
			if (serverQuery !== undefined && onQueryChange !== undefined) {
				onQueryChange(withDataTableSearch(serverQuery, value), { kind: "search" });
				return;
			}
			setGlobalFilter(value);
			setClientPagination((previous) => (previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }));
		},
		[serverQuery, onQueryChange],
	);

	const searchDebounceMs = search?.debounceMs ?? 0;
	const handleSearchChange = React.useCallback(
		(value: string): void => {
			setSearchInput(value);
			if (searchTimerRef.current !== null) {
				clearTimeout(searchTimerRef.current);
			}
			if (searchDebounceMs <= 0) {
				applySearch(value);
				return;
			}
			searchTimerRef.current = setTimeout((): void => {
				applySearch(value);
			}, searchDebounceMs);
		},
		[applySearch, searchDebounceMs],
	);
	const handleSearchClear = React.useCallback((): void => {
		setSearchInput("");
		if (searchTimerRef.current !== null) {
			clearTimeout(searchTimerRef.current);
		}
		applySearch("");
	}, [applySearch]);

	// ── State change handlers ──────────────────────────────────────────────
	const handleSortingChange = React.useCallback(
		(updater: Updater<SortingState>): void => {
			const next = applyTableUpdater(updater, sorting);
			if (serverQuery !== undefined && onQueryChange !== undefined) {
				onQueryChange(withDataTableSorting(serverQuery, next), { kind: "sorting" });
				return;
			}
			setClientSorting(next);
			persist({ sorting: next });
		},
		[sorting, serverQuery, onQueryChange, persist],
	);

	const handlePaginationChange = React.useCallback(
		(updater: Updater<PaginationState>): void => {
			const next = applyTableUpdater(updater, pagination);
			if (serverQuery !== undefined && onQueryChange !== undefined) {
				if (next.pageSize !== pagination.pageSize) {
					onQueryChange(withDataTablePageSize(serverQuery, next.pageSize), { kind: "page-size" });
				} else if (next.pageIndex !== pagination.pageIndex) {
					onQueryChange(withDataTablePage(serverQuery, next.pageIndex), { kind: "page" });
				}
				return;
			}
			if (isPaged) {
				setClientPagination(next);
			}
		},
		[pagination, serverQuery, onQueryChange, isPaged],
	);

	const handleColumnVisibilityChange = React.useCallback(
		(updater: Updater<ColumnVisibilityState>): void => {
			const next = applyTableUpdater(updater, chosenColumnVisibility);
			setColumnVisibility(next);
			persist({ columnVisibility: next });
		},
		[chosenColumnVisibility, persist],
	);
	const handleColumnPinningChange = React.useCallback(
		(updater: Updater<ColumnPinningState>): void => {
			const next = applyTableUpdater(updater, columnPinning);
			setColumnPinning(next);
			persist({ columnPinning: next });
		},
		[columnPinning, persist],
	);
	const handleColumnOrderChange = React.useCallback(
		(updater: Updater<ColumnOrderState>): void => {
			const next = applyTableUpdater(updater, columnOrder);
			setColumnOrder(next);
			persist({ columnOrder: next });
		},
		[columnOrder, persist],
	);
	const handleColumnSizingChange = React.useCallback(
		(updater: Updater<ColumnSizingState>): void => {
			const next = applyTableUpdater(updater, columnSizing);
			setColumnSizing(next);
			persist({ columnSizing: next });
		},
		[columnSizing, persist],
	);

	// ── The table ──────────────────────────────────────────────────────────
	const searchKeys = search?.keys;
	const getSubRows = tree?.getSubRows;
	const defaultExpanded = tree?.defaultExpanded === true || props.grouping?.defaultExpanded === true;
	// A server groups its own rows, so a server table is never grouped here.
	const groupBy = isServer ? undefined : props.grouping?.by;
	const groupingState = React.useMemo((): string[] => [...(groupBy ?? [])], [groupBy]);
	const serverTotalCount = serverSource?.totalCount;
	const cascadeSelection = selection?.cascade ?? true;
	// A tree the table itself is narrowing (a search or a filter over rows it holds). A server answers with the rows
	// it chose, so there is nothing to open on its behalf.
	const isNarrowedTree = hasTree && !isServer && (globalFilter !== "" || columnFilters.length > 0);

	// ── Open rows (tree branches and detail rows) ─────────────────────────
	// The reader's own open and closed rows. While a search or a filter narrows a tree, every branch is shown open
	// instead (a match deep inside is on screen without hunting for it), and what the reader opens or closes then
	// belongs to that one search: it is kept under the search's key and forgotten when the search changes. Their own
	// choices are untouched throughout and return when the search is cleared.
	const [expanded, setExpanded] = React.useState<ExpandedState>(() => (defaultExpanded ? true : {}));
	const narrowingKey = isNarrowedTree ? JSON.stringify([globalFilter, columnFilters]) : null;
	const [narrowedExpanded, setNarrowedExpanded] = React.useState<{ readonly key: string; readonly expanded: ExpandedState } | null>(null);
	const shownExpanded: ExpandedState = narrowingKey === null ? expanded : narrowedExpanded?.key === narrowingKey ? narrowedExpanded.expanded : true;
	const handleExpandedChange = React.useCallback(
		(updater: Updater<ExpandedState>): void => {
			const next = applyTableUpdater(updater, shownExpanded);
			if (narrowingKey === null) {
				setExpanded(next);
			} else {
				setNarrowedExpanded({ key: narrowingKey, expanded: next });
			}
		},
		[shownExpanded, narrowingKey],
	);

	// Memoized so the `table` wrapper keeps one identity between state changes.
	const tableOptions = React.useMemo(
		(): TableOptions<TableEngineFeatures, TData> => ({
			features: tableEngineFeatures,
			data,
			columns,
			defaultColumn: SELECT_FILTER_COLUMN_DEFAULTS,
			getRowId: (row: TData): string => getRowId(row),
			state: {
				sorting,
				columnFilters,
				globalFilter,
				pagination,
				columnVisibility,
				columnPinning,
				columnOrder,
				columnSizing,
				expanded: shownExpanded,
				grouping: groupingState,
			},
			onExpandedChange: handleExpandedChange,
			// In a tree a row is kept when it matches OR holds a match, so a match never loses the parents that place it.
			filterFromLeafRows: hasTree,
			onSortingChange: handleSortingChange,
			onColumnFiltersChange: setColumnFilters,
			onGlobalFilterChange: setGlobalFilter,
			onPaginationChange: handlePaginationChange,
			onColumnVisibilityChange: handleColumnVisibilityChange,
			onColumnPinningChange: handleColumnPinningChange,
			onColumnOrderChange: handleColumnOrderChange,
			onColumnSizingChange: handleColumnSizingChange,
			enableRowSelection: isSelectable,
			enableSubRowSelection: cascadeSelection,
			enableColumnPinning: columnControls?.pinning === true,
			enableColumnResizing: columnControls?.resizing === true,
			enableRowPinning: rowPinning,
			keepPinnedRows: true,
			manualPagination: isServer,
			manualSorting: isServer,
			manualFiltering: isServer,
			...(serverTotalCount === undefined ? {} : { rowCount: serverTotalCount }),
			...(getSubRows === undefined ? {} : { getSubRows: (row: TData): TData[] | undefined => getSubRows(row) }),
			...(hasDetail ? { getRowCanExpand: (): boolean => true } : {}),
			globalFilterFn: (row, _columnId, filterValue): boolean => {
				if (searchKeys === undefined || searchKeys.length === 0) {
					return true;
				}
				const needleParsed = DataTableCellScalarSchema.safeParse(filterValue);
				const needle = needleParsed.success ? String(needleParsed.data).toLowerCase() : "";
				// Read from the row itself, so a field matches whether or not a column shows it.
				return searchKeys.some((key) =>
					toDataTableCellString(parseDataTableCellValue(readDataTableRowField(row.original, key)))
						.toLowerCase()
						.includes(needle),
				);
			},
		}),
		[
			data,
			columns,
			getRowId,
			sorting,
			columnFilters,
			globalFilter,
			pagination,
			columnVisibility,
			columnPinning,
			columnOrder,
			columnSizing,
			handleSortingChange,
			handlePaginationChange,
			handleColumnVisibilityChange,
			handleColumnPinningChange,
			handleColumnOrderChange,
			handleColumnSizingChange,
			isSelectable,
			cascadeSelection,
			columnControls?.pinning,
			columnControls?.resizing,
			rowPinning,
			isServer,
			serverTotalCount,
			getSubRows,
			hasTree,
			shownExpanded,
			handleExpandedChange,
			groupingState,
			hasDetail,
			searchKeys,
		],
	);

	const table = useTable(tableOptions);

	// ── Selection scope ────────────────────────────────────────────────────
	const controlledScope = selection?.scope;
	const onControlledScopeChange = selection?.onScopeChange;
	const [ownScope, setOwnScope] = React.useState<DataTableSelectionScope>("page");
	const scope = onControlledScopeChange === undefined ? ownScope : (controlledScope ?? "page");
	const handleScopeChange = React.useCallback(
		(next: DataTableSelectionScope): void => {
			if (onControlledScopeChange === undefined) {
				setOwnScope(next);
			} else {
				onControlledScopeChange(next);
			}
		},
		[onControlledScopeChange],
	);

	// A server table shows other rows after every page, page-size, sort or filter change: a selection made on the
	// rows before would name rows no longer on screen, so it is dropped. (The selection bar then drops an
	// "every matching row" scope back to the page, as it does whenever a ticked row is unticked.)
	// Keyed on the query's VALUE: a parent that rebuilds an equal query object on every render must not clear it.
	const serverQueryKey = serverQuery === undefined ? "" : JSON.stringify(serverQuery);
	// The reset itself changes the table's state (and so the `table` wrapper): the effect reads the latest table
	// through a ref instead of depending on it, or it would run again for its own write.
	const tableRef = React.useRef(table);
	React.useEffect((): void => {
		tableRef.current = table;
	}, [table]);
	React.useEffect((): void => {
		if (isServer) {
			tableRef.current.resetRowSelection();
		}
	}, [isServer, serverQueryKey, data]);

	// ── Filters ────────────────────────────────────────────────────────────
	const filterValues = React.useMemo((): Readonly<Record<string, DataTableFilterValue>> => {
		if (serverQuery !== undefined) {
			return serverQuery.filters;
		}
		const values: Record<string, DataTableFilterValue> = {};
		for (const columnFilter of columnFilters) {
			const parsed = ClientFilterValueSchema.safeParse(columnFilter.value);
			if (parsed.success) {
				values[columnFilter.id] = parsed.data;
			}
		}
		return values;
	}, [serverQuery, columnFilters]);

	const handleFilterChange = React.useCallback(
		(column: string, value: DataTableFilterValue | null): void => {
			if (serverQuery !== undefined && onQueryChange !== undefined) {
				onQueryChange(withDataTableFilter(serverQuery, column, value), { kind: "filter", column, value });
				return;
			}
			const isEmpty = isEmptyDataTableFilterValue(value);
			setColumnFilters((previous) => [...previous.filter((entry) => entry.id !== column), ...(isEmpty ? [] : [{ id: column, value }])]);
			setClientPagination((previous) => (previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }));
		},
		[serverQuery, onQueryChange],
	);

	const handleClearFilters = React.useCallback((): void => {
		setSearchInput("");
		if (searchTimerRef.current !== null) {
			clearTimeout(searchTimerRef.current);
		}
		if (serverQuery !== undefined && onQueryChange !== undefined) {
			onQueryChange(withDataTableFiltersCleared(serverQuery), { kind: "clear-filters" });
			return;
		}
		setGlobalFilter("");
		setColumnFilters([]);
	}, [serverQuery, onQueryChange]);

	// Facets count the rows the table holds, so they exist only client-side.
	const filterCounts = React.useMemo((): Readonly<Record<string, ReadonlyMap<string, number>>> | null => {
		if (isServer) {
			return null;
		}
		const counts: Record<string, ReadonlyMap<string, number>> = {};
		for (const filter of filters ?? []) {
			// A range of days has no options to count.
			if (filter.kind !== "date-range") {
				counts[filter.column] = normalizeFacetedUniqueValues(table.getColumn(filter.column)?.getFacetedUniqueValues());
			}
		}
		return counts;
		// `table` is a new wrapper after every state or data change, so the facets follow the rows and the filters.
	}, [isServer, filters, table]);

	// ── Paging ─────────────────────────────────────────────────────────────
	const handlePageChange = React.useCallback(
		(pageIndex: number): void => {
			handlePaginationChange((previous) => ({ ...previous, pageIndex }));
		},
		[handlePaginationChange],
	);
	const handlePageSizeChange = React.useCallback(
		(pageSize: number): void => {
			handlePaginationChange((): PaginationState => ({ pageIndex: 0, pageSize }));
			if (!isServer) {
				persist({ pageSize });
			}
		},
		[handlePaginationChange, isServer, persist],
	);

	const filteredRowCount = table.getFilteredRowModel().rows.length;
	const isFiltered = serverQuery === undefined ? globalFilter !== "" || columnFilters.length > 0 : isDataTableQueryFiltered(serverQuery) || serverSource?.isFiltered === true;
	const visibleRows = table.getRowModel().rows.map((row): DataTableReorderRow => ({ id: row.id, parentId: row.parentId ?? null }));

	// ── Detail panel ───────────────────────────────────────────────────────
	// A panel whose row a search, a filter or a page change took off the screen closes. Set during render (not in an
	// effect) so the panel and the columns it hid go in the same paint.
	if (panelRowId !== null && !visibleRows.some((row) => row.id === panelRowId)) {
		setPanelRowId(null);
	}
	const panelIndex = panelRowId === null ? -1 : visibleRows.findIndex((row) => row.id === panelRowId);
	const handlePanelStep = React.useCallback(
		(step: -1 | 1): void => {
			const target = visibleRows.at(panelIndex + step);
			if (panelIndex !== -1 && target !== undefined && panelIndex + step >= 0) {
				setPanelRowId(target.id);
			}
		},
		[visibleRows, panelIndex],
	);

	const toolbarSearch = React.useMemo(
		(): ToolbarSearch | null => (search === undefined ? null : { value: searchInput, onChange: handleSearchChange, onClear: handleSearchClear }),
		[search, searchInput, handleSearchChange, handleSearchClear],
	);

	return {
		table,
		columns,
		mode: source.mode,
		onFetchAllMatching: serverSource?.onFetchAllMatching,
		search: toolbarSearch,
		filterValues,
		filterCounts,
		onFilterChange: handleFilterChange,
		onClearFilters: handleClearFilters,
		isFiltered,
		matchingCount: serverTotalCount ?? filteredRowCount,
		pageIndex: pagination.pageIndex,
		pageSize: pagination.pageSize,
		pageSizeOptions,
		onPageChange: handlePageChange,
		onPageSizeChange: handlePageSizeChange,
		scope,
		onScopeChange: handleScopeChange,
		visibleRows,
		density,
		onDensityChange: handleDensityChange,
		isPrinting,
		panelRowId,
		onPanelRowChange: setPanelRowId,
		onPanelStep: handlePanelStep,
	};
}
