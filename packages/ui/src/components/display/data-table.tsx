"use client";

// ============================================================
// components/display/data-table.tsx
//
// A fully-featured, generic data table built on TanStack Table **v9**
// (`useTable` + a module-scope `tableFeatures()` feature set — the v9
// paradigm).
//
// The component is deliberately **dumb** (rules 9/10/11): the smart component
// owns the data, the column defs, the filters, the actions and the copy. Every
// string (search placeholder, empty state, export labels, action labels)
// arrives via props — nothing is fetched or hardcoded here.
//
// Features: search (global filter over `searchKeys`), column filters, column
// visibility, column pinning, CSV/JSON/PDF/Excel export, localStorage
// preference persistence, row click, inline editing, native HTML5 drag-and-drop
// row reordering, bulk selection (+select-all-pages), a mobile card view, and
// server-side (`manual`) mode.
// ============================================================

import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/display/table";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/feedback/empty";

import {
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
	flexRender,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	tableFeatures,
	useTable,
	Subscribe,
	type Cell,
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnPinningState,
	type ColumnVisibilityState,
	type Header,
	type PaginationState,
	type Row,
	type RowData,
	type RowSelectionState,
	type SortingState,
	type Table as TanStackTable,
	type TableOptions,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	CircleAlert,
	Columns3,
	FileDown,
	GripVertical,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Search,
	X,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@workspace/ui/lib/utils";
import { buildExportColumns, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet } from "@workspace/ui/lib/data-table-export";
import { formatDataTableLabel, type DataTableLabels } from "@workspace/ui/lib/data-table-labels";
import {
	DataTableCellScalarSchema,
	DataTableCellValueSchema,
	normalizeFacetedUniqueValues,
	toDataTableCellString,
	type DataTableCellScalar,
	type DataTablePersistedPrefs,
	type DataTablePersistedPrefsPatch,
} from "@workspace/ui/lib/data-table-prefs";
import { createLocalStorageDataTableStorage, type DataTableStorageAdapter } from "@workspace/ui/lib/data-table-storage";

// ── Generic-preserving memo ────────────────────────────────────────────────
// React's built-in `React.memo` collapses a generic component signature
// (`<TData extends RowData>(props: P<TData>) => JSX`) down to its constraint
// (`RowData`), which then breaks TanStack v9's invariant generics at every
// call site. This wrapper keeps the exact signature while still memoizing.
function memoGeneric<P extends object>(Component: (props: P) => React.JSX.Element): (props: P) => React.JSX.Element {
	const Inner = React.memo(Component);
	return function MemoWrapper(props: P): React.JSX.Element {
		return <Inner {...props} />;
	};
}

// ── The v9 feature set (module scope — built once, shared by every instance) ─

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

/** Default row height (px) for row virtualization — matches the `h-18` row class. */
const DEFAULT_ROW_HEIGHT = 72;

/** Rows rendered above/below the visible band while virtualizing. */
const VIRTUAL_OVERSCAN = 6;

/** Default page-size options when `pageSizeOptions` is not provided. */
const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 50, 100];

const EMPTY_FILTERS: Filter[] = [];
const EMPTY_ACTIONS: Action[] = [];
const EMPTY_SEARCH_KEYS: string[] = [];
const EMPTY_BULK_ACTIONS: BulkAction[] = [];
const EMPTY_PINNED_STYLES: React.CSSProperties = {};
const EMPTY_COLUMN_PINNING: ColumnPinningState = { start: [], end: [] };
const EMPTY_COLUMN_VISIBILITY: ColumnVisibilityState = {};
const EMPTY_FACETED_COUNTS: ReadonlyMap<string, number> = new Map<string, number>();

const PIN_SHADOW_START = "2px 0 4px rgba(0,0,0,0.08)";
const PIN_SHADOW_END = "-2px 0 4px rgba(0,0,0,0.08)";

function buildPinnedColumnStyles(isPinned: false | "start" | "end", start: number, after: number, zIndex: number): React.CSSProperties {
	if (!isPinned) {
		return EMPTY_PINNED_STYLES;
	}
	return {
		position: "sticky",
		left: isPinned === "start" ? `${String(start)}px` : undefined,
		right: isPinned === "end" ? `${String(after)}px` : undefined,
		zIndex,
		backgroundColor: "var(--color-card)",
		boxShadow: isPinned === "start" ? PIN_SHADOW_START : PIN_SHADOW_END,
	};
}

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

// ── Filter / Action / BulkAction Types ─────────────────────────────────────

export interface Filter {
	readonly key: string;
	readonly label: string;
	readonly options: readonly { value: string; label: string }[];
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

export interface BulkAction<TData extends RowData = RowData> {
	readonly key: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly onClick: (selectedRows: TData[]) => void | Promise<void>;
	readonly variant?: "default" | "destructive" | "outline";
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

export type { DataTableLabels } from "@workspace/ui/lib/data-table-labels";
export type { DataTableStorageAdapter } from "@workspace/ui/lib/data-table-storage";
export { createLocalStorageDataTableStorage } from "@workspace/ui/lib/data-table-storage";
export { sanitizeExportCell, exportToCSV, exportToJSON, exportToPDF, exportToSpreadsheet, buildExportColumns } from "@workspace/ui/lib/data-table-export";

// ── DataTable Props ────────────────────────────────────────────────────────

export interface DataTableProps<TData extends RowData> {
	readonly ref?: React.Ref<HTMLDivElement>;
	// Core
	readonly data: TData[];
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	readonly filters?: Filter[];
	readonly actions?: Action<TData>[];
	readonly searchKeys?: string[];
	readonly pageSize?: number;
	readonly pageSizeOptions?: readonly number[];
	readonly title?: string;
	readonly description?: string;

	// Responsive
	readonly mobileCardRender?: (item: TData, actions?: Action<TData>[]) => React.ReactNode;

	// Bulk selection
	readonly enableBulkSelection?: boolean;
	readonly bulkActions?: BulkAction<TData>[];

	// Empty state
	readonly emptyState?: EmptyStateConfig;

	// Appearance
	readonly className?: string;

	// ── NEW FEATURE 1: Row click ──────────────────────────────────────────
	readonly onRowClick?: (row: TData) => void;

	// ── NEW FEATURE 2: Column visibility toggle ───────────────────────────
	readonly enableColumnVisibility?: boolean;

	// ── NEW FEATURE 3: CSV Export ─────────────────────────────────────────
	readonly exportable?: boolean;
	readonly exportFilename?: string;
	readonly exportableColumns?: string[];

	// ── NEW FEATURE 4: Preference persistence ─────────────────────────────
	readonly persistKey?: string;
	readonly storage?: DataTableStorageAdapter;

	// ── Bulk selection: cross-page select-all (controlled or internal) ────
	readonly selectAllPages?: boolean;
	readonly onSelectAllPagesChange?: (selectAllPages: boolean) => void;

	// ── NEW FEATURE 5: Column pinning ──────────────────────────────────────
	readonly enableColumnPinning?: boolean;

	// ── NEW FEATURE 6: Server-side mode ───────────────────────────────────
	readonly manual?: boolean;
	readonly totalCount?: number;
	// Manual-mode pager round-trip: fires with the 1-based page + page size the
	// consumer must fetch. `totalCount` comes back in the response; the table
	// never mutates external data, so the parent owns the refetch.
	readonly onManualPaginationChange?: (page: number, pageSize: number) => void;

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
	readonly isLoading?: boolean;
	readonly skeletonRows?: number;
	readonly error?: string | null;

	// ── Robustness: Sort cycle ──────────────────────────────────────────
	readonly sortCycle?: "asc-desc" | "asc-desc-none";

	/** User-visible strings for menus and affordances (rule 11). */
	readonly labels: DataTableLabels;
}

// ── Editable Cell ──────────────────────────────────────────────────────────

interface EditingCell {
	readonly rowIndex: number;
	readonly columnId: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Coerce a TanStack cell into a display string via Zod at the library boundary. */
function cellValueDisplayString<TData extends RowData>(cell: Cell<DataTableFeatures, TData>): string {
	const parsed = DataTableCellValueSchema.safeParse(cell.getValue());
	return parsed.success ? toDataTableCellString(parsed.data) : "";
}

function getSortIcon<TData extends RowData>(column: Column<DataTableFeatures, TData>): React.JSX.Element {
	const sorted = column.getIsSorted();
	if (sorted === "asc") return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
	if (sorted === "desc") return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
	return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
}

// ── Inline Edit Input ──────────────────────────────────────────────────────

const InlineEditInput = React.memo(function InlineEditInput({
	value,
	onSave,
	onCancel,
}: {
	readonly value: string;
	readonly onSave: (value: string) => void;
	readonly onCancel: () => void;
}): React.JSX.Element {
	const inputRef = useRef<HTMLInputElement>(null);
	const [editValue, setEditValue] = useState(value);
	const savedRef = useRef(false);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setEditValue(e.target.value);
	}, []);

	const save = useCallback(
		(val: string): void => {
			if (savedRef.current) return;
			savedRef.current = true;
			onSave(val);
		},
		[onSave],
	);

	const handleBlur = useCallback((): void => {
		save(editValue);
	}, [save, editValue]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>): void => {
			if (e.key === "Enter") {
				save(editValue);
			} else if (e.key === "Escape") {
				onCancel();
			}
		},
		[save, editValue, onCancel],
	);

	return (
		<div className="flex items-center gap-1">
			<input
				ref={inputRef}
				value={editValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				className="h-7 w-full rounded border border-input bg-background px-2 text-sm ring-1 ring-ring outline-none"
			/>
		</div>
	);
});

// ── Drag Handle Cell ───────────────────────────────────────────────────────

const DragHandleCell = React.memo(function DragHandleCell({ isDragged }: { readonly isDragged?: boolean }): React.JSX.Element {
	return (
		<div className={cn("flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground", isDragged === true && "cursor-grabbing text-primary")}>
			<GripVertical className="h-4 w-4" />
		</div>
	);
});

// ── Selection Checkboxes (sub-components: per-row closures live inside, never inline) ─

interface SelectAllCheckboxProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly onAnyDeselect: () => void;
	readonly labels: DataTableLabels;
}

const SelectAllCheckbox = memoGeneric(function SelectAllCheckbox<TData extends RowData>({ table, onAnyDeselect, labels }: SelectAllCheckboxProps<TData>): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(value: boolean): void => {
			table.toggleAllPageRowsSelected(value);
			if (!value) onAnyDeselect();
		},
		[table, onAnyDeselect],
	);

	// Granular subscription: the header box re-renders only when the
	// `rowSelection` slice changes, never when the toolbar slices change.
	// (`atoms.rowSelection` is always present — every DataTable registers the
	// rowSelectionFeature, so the slice atom is guaranteed by the feature type.)
	const renderCheckbox = (): React.JSX.Element => (
		<Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={handleCheckedChange} aria-label={labels.selectAllAriaLabel} />
	);
	return <Subscribe source={table.atoms.rowSelection}>{renderCheckbox}</Subscribe>;
});

interface SelectRowCheckboxProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly onAnyDeselect: () => void;
	readonly labels: DataTableLabels;
	readonly className?: string;
}

const SelectRowCheckbox = memoGeneric(function SelectRowCheckbox<TData extends RowData>({
	row,
	table,
	onAnyDeselect,
	labels,
	className,
}: SelectRowCheckboxProps<TData>): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(value: boolean): void => {
			row.toggleSelected(value);
			if (!value) onAnyDeselect();
		},
		[row, onAnyDeselect],
	);

	// Per-row granular subscription: this checkbox re-renders only when THIS
	// row's selection flips — row objects are cached by the row model (stable
	// identity), so without the atom subscription a memoized row would never
	// pick up a `toggleAllPageRowsSelected` from the header box.
	const isRowSelected = useCallback((selection: RowSelectionState): boolean => selection[row.id] === true, [row.id]);
	const renderCheckbox = (isSelected: boolean): React.JSX.Element => (
		<Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} aria-label={labels.selectRowAriaLabel} className={className} />
	);
	return (
		<Subscribe source={table.atoms.rowSelection} selector={isRowSelected}>
			{renderCheckbox}
		</Subscribe>
	);
});

// ── Row Actions Dropdown (sub-component: row + actions arrive as props) ─────

interface RowActionsMenuProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly actions: Action<TData>[];
	readonly labels: DataTableLabels;
}

const RowActionsMenu = memoGeneric(function RowActionsMenu<TData extends RowData>({ row, actions, labels }: RowActionsMenuProps<TData>): React.JSX.Element {
	const handleStopPropagation = useCallback((e: React.SyntheticEvent): void => {
		e.stopPropagation();
	}, []);

	const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
		if (e.key === "Enter" || e.key === " ") {
			e.stopPropagation();
		}
	}, []);

	// Delegated handler — reads the action key off the clicked item's data
	// attribute, so the mapped items never bind per-item closures (rule 16).
	const handleActionClick = useCallback(
		(e: React.SyntheticEvent): void => {
			const key = e.currentTarget.getAttribute("data-action-key");
			const action = actions.find((candidate) => candidate.key === key);
			if (action !== undefined) {
				action.onClick(row.original);
			}
		},
		[actions, row],
	);

	return (
		<div className="text-right" onClick={handleStopPropagation} onKeyDown={handleKeyDown} role="presentation">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
					<span className="sr-only">{labels.openRowMenu}</span>
					<MoreHorizontal className="h-4 w-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64 p-2">
					<div className="mb-2 px-2 text-xs font-medium text-muted-foreground">{labels.actionsMenuTitle}</div>
					{actions.map((action) => (
						<DropdownMenuItem
							key={action.key}
							data-action-key={action.key}
							onClick={handleActionClick}
							className={cn("flex cursor-pointer items-center gap-3 rounded-md p-3", action.className ?? "hover:bg-info-soft dark:hover:bg-info-soft")}>
							<div className={cn("flex h-8 w-8 items-center justify-center rounded-full", action.iconBgColor ?? "bg-info-soft dark:bg-info-soft")}>{action.icon}</div>
							<div className="flex flex-col">
								<span className={cn("font-medium", action.isDestructive === true ? "text-destructive" : "text-foreground")}>{action.label}</span>
								{action.description !== undefined ? <span className="text-xs text-muted-foreground">{action.description}</span> : null}
							</div>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
});

// ── Export Dropdown (sub-component: owns the four format handlers) ──────────

interface ExportMenuProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	readonly exportFilename?: string;
	readonly exportableColumns?: string[];
	readonly labels: DataTableLabels;
}

/** Selection-aware row projection used by every export format. */
function getExportRows<TData extends RowData>(table: TanStackTable<DataTableFeatures, TData>): TData[] {
	const selectedRows = table.getSelectedRowModel().rows;
	if (selectedRows.length > 0) {
		return selectedRows.map((row) => row.original);
	}
	return table.getFilteredRowModel().rows.map((row) => row.original);
}

/** Selector factory: `true` when the row with `rowId` is in the selection set. */
const rowSelectionSelector =
	(rowId: string): ((selection: RowSelectionState) => boolean) =>
	(selection: RowSelectionState): boolean =>
		selection[rowId] === true;

const ExportMenu = memoGeneric(function ExportMenu<TData extends RowData>({
	table,
	columns,
	exportFilename,
	exportableColumns,
	labels,
}: ExportMenuProps<TData>): React.JSX.Element {
	const exportCols = useMemo((): ColumnDef<DataTableFeatures, TData>[] => {
		const base = buildExportColumns(columns);
		if (exportableColumns !== undefined && exportableColumns.length > 0) {
			return base.filter((col) => {
				const key = "id" in col ? String(col.id) : "accessorKey" in col ? String(col.accessorKey) : undefined;
				return key !== undefined && exportableColumns.includes(key);
			});
		}
		return base;
	}, [columns, exportableColumns]);

	// The export panel subscribes to the `rowSelection` atom so its row set is
	// always fresh even though the parent never re-renders on selection changes
	// (#6). Selection-aware export: selected rows first, else the filtered set.
	const filename = exportFilename?.replace(/\.\w+$/, "") ?? "export";
	const csvFilename = exportFilename ?? "export.csv";

	// Stable handlers (rule 16): each reads the selection-fresh row set at click
	// time, so the menu never ships stale rows even though the parent doesn't
	// re-render on selection changes (#6).
	const handleExportCSV = useCallback((): void => {
		exportToCSV(getExportRows(table), exportCols, csvFilename);
	}, [table, exportCols, csvFilename]);

	const handleExportJSON = useCallback((): void => {
		exportToJSON(getExportRows(table), exportCols, filename);
	}, [table, exportCols, filename]);

	const handleExportPDF = useCallback((): void => {
		exportToPDF(getExportRows(table), exportCols, filename);
	}, [table, exportCols, filename]);

	const handleExportSpreadsheet = useCallback((): void => {
		exportToSpreadsheet(getExportRows(table), exportCols, filename);
	}, [table, exportCols, filename]);

	// Re-render the menu (and thus recompute the exported row set) whenever the
	// selection slice changes — the parent does not subscribe to it (#6).
	const renderMenu = (): React.JSX.Element => (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
				<FileDown className="h-4 w-4" />
				<span>{labels.export}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44 p-1.5">
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">{labels.exportAs}</div>
				<DropdownMenuItem onClick={handleExportCSV} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-success-soft dark:bg-success-soft">
						<FileDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{labels.exportCsv}</span>
						<span className="text-[10px] text-muted-foreground">{labels.exportCsvDescription}</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportJSON} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-info-soft dark:bg-info-soft/30">
						<FileDown className="h-3.5 w-3.5 text-info" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{labels.exportJson}</span>
						<span className="text-[10px] text-muted-foreground">{labels.exportJsonDescription}</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportPDF} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive-soft dark:bg-destructive-soft">
						<FileDown className="h-3.5 w-3.5 text-destructive" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{labels.exportPdf}</span>
						<span className="text-[10px] text-muted-foreground">{labels.exportPdfDescription}</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportSpreadsheet} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-success-soft dark:bg-success-soft">
						<FileDown className="h-3.5 w-3.5 text-success" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{labels.exportSpreadsheet}</span>
						<span className="text-[10px] text-muted-foreground">{labels.exportSpreadsheetDescription}</span>
					</div>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	// Re-render the menu (and thus recompute the exported row set) whenever the
	// selection slice changes — the parent does not subscribe to it (#6).
	return <Subscribe source={table.atoms.rowSelection}>{renderMenu}</Subscribe>;
});

// ── Column Visibility Dropdown (sub-component: per-column toggles live here) ─

interface ColumnVisibilityMenuProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly columnVisibility: ColumnVisibilityState;
	readonly onVisibilityChange: (visibility: ColumnVisibilityState) => void;
	readonly labels: DataTableLabels;
}

const ColumnVisibilityItem = memoGeneric(function ColumnVisibilityItem<TData extends RowData>({
	col,
	onToggle,
}: {
	readonly col: Column<DataTableFeatures, TData>;
	readonly onToggle: (col: Column<DataTableFeatures, TData>) => void;
}): React.JSX.Element {
	const handleCheckedChange = useCallback((): void => {
		onToggle(col);
	}, [col, onToggle]);

	const header = col.columnDef.header;
	const label = typeof header === "string" ? header : col.id;

	return (
		<DropdownMenuCheckboxItem checked={col.getIsVisible()} onCheckedChange={handleCheckedChange}>
			{label}
		</DropdownMenuCheckboxItem>
	);
});

const ColumnVisibilityMenu = memoGeneric(function ColumnVisibilityMenu<TData extends RowData>({
	table,
	columnVisibility,
	onVisibilityChange,
	labels,
}: ColumnVisibilityMenuProps<TData>): React.JSX.Element {
	const columns = useMemo(() => table.getAllLeafColumns().filter((col) => col.getCanHide()), [table]);

	const handleToggle = useCallback(
		(col: Column<DataTableFeatures, TData>): void => {
			// v9's `table.state` is intentionally opaque — compute the next
			// visibility from the component's own snapshot instead of reading it.
			col.toggleVisibility(!col.getIsVisible());
			onVisibilityChange({ ...columnVisibility, [col.id]: !col.getIsVisible() });
		},
		[columnVisibility, onVisibilityChange],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
				<Columns3 className="h-4 w-4" />
				<span>{labels.columnsToggle}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{columns.map((col) => (
					<ColumnVisibilityItem key={col.id} col={col} onToggle={handleToggle} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

// ── Column Filter Select (sub-component: the per-filter closure lives here) ──

interface ColumnFilterSelectProps {
	readonly filter: Filter;
	readonly value: string;
	readonly totalFilteredRows: number;
	readonly facetedCounts: ReadonlyMap<string, number>;
	readonly onFilterChange: (filterKey: string, value: string | null) => void;
}

const ColumnFilterSelect = React.memo(function ColumnFilterSelect({
	filter,
	value,
	totalFilteredRows,
	facetedCounts,
	onFilterChange,
}: ColumnFilterSelectProps): React.JSX.Element {
	const handleValueChange = useCallback(
		(next: string | null): void => {
			onFilterChange(filter.key, next);
		},
		[filter, onFilterChange],
	);

	const labelFor = useCallback(
		(option: { readonly value: string; readonly label: string }): string => {
			const count = facetedCounts.get(option.value);
			return count !== undefined ? `${option.label} (${String(count)})` : option.label;
		},
		[facetedCounts],
	);

	return (
		<Select<string> value={value} onValueChange={handleValueChange}>
			<SelectTrigger className="h-9 w-full text-sm sm:w-44">
				<SelectValue placeholder={filter.label} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">
					All {filter.label} ({String(totalFilteredRows)})
				</SelectItem>
				{filter.options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{labelFor(option)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});

// ── Bulk Action Button (sub-component: the per-action closure lives here) ───

interface BulkActionButtonProps<TData extends RowData> {
	readonly action: BulkAction<TData>;
	readonly selectedRows: TData[];
	readonly onDone: () => void;
}

const BulkActionButton = memoGeneric(function BulkActionButton<TData extends RowData>({ action, selectedRows, onDone }: BulkActionButtonProps<TData>): React.JSX.Element {
	const handleClick = useCallback((): void => {
		// onClick may be sync (void) or async — normalize so the
		// row-selection reset always runs after the action settles.
		void Promise.resolve(action.onClick(selectedRows)).then(onDone);
	}, [action, selectedRows, onDone]);

	return (
		<Button variant={action.variant ?? "outline"} size="sm" onClick={handleClick} className="shrink-0 gap-1.5 text-xs sm:text-sm">
			{action.icon}
			<span className="hidden sm:inline">{action.label}</span>
			<span className="sm:hidden">{action.label.split(" ")[0]}</span>
		</Button>
	);
});

// ── Page Number Button (sub-component: the per-page closure lives here) ─────

interface PageNumberButtonProps {
	readonly pageNumber: number;
	readonly currentPage: number;
	readonly onPageSelect: (pageNumber: number) => void;
}

const PageNumberButton = React.memo(function PageNumberButton({ pageNumber, currentPage, onPageSelect }: PageNumberButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onPageSelect(pageNumber);
	}, [onPageSelect, pageNumber]);

	return (
		<Button
			variant={currentPage === pageNumber ? "default" : "outline"}
			size="sm"
			onClick={handleClick}
			className="h-8 w-8 p-0"
			aria-label={`Go to page ${String(pageNumber)}`}>
			{pageNumber}
		</Button>
	);
});

// ── Page Size Select (sub-component) ───────────────────────────────────────

interface PageSizeSelectProps {
	readonly pageSize: number;
	readonly options: readonly number[];
	readonly onPageSizeChange: (size: number) => void;
}

const PageSizeSelect = React.memo(function PageSizeSelect({ pageSize, options, onPageSizeChange }: PageSizeSelectProps): React.JSX.Element {
	const handleValueChange = useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onPageSizeChange(Number(value));
			}
		},
		[onPageSizeChange],
	);

	return (
		<Select<string> value={String(pageSize)} onValueChange={handleValueChange}>
			<SelectTrigger className="w-20">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((size) => (
					<SelectItem key={size} value={String(size)}>
						{size}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});

// ── Header Cell (sub-component: sort + pin affordances live here) ───────────

interface HeaderCellProps<TData extends RowData> {
	readonly header: Header<DataTableFeatures, TData>;
	readonly enableColumnPinning: boolean;
	readonly sortCycle: "asc-desc" | "asc-desc-none";
	readonly onTogglePin: (columnId: string) => void;
}

const HeaderCell = memoGeneric(function HeaderCell<TData extends RowData>({ header, enableColumnPinning, sortCycle, onTogglePin }: HeaderCellProps<TData>): React.JSX.Element {
	const column = header.column;
	const isPinned = column.getIsPinned();

	// Sort cycle: default toggles asc ↔ desc; with "asc-desc-none" a third
	// click clears the sort entirely (v9 has no built-in three-state toggle).
	const handleHeaderClick = useCallback((): void => {
		if (!column.getCanSort()) return;
		const sorted = column.getIsSorted();
		if (sortCycle === "asc-desc-none") {
			if (sorted === false) {
				column.toggleSorting(false);
			} else if (sorted === "asc") {
				column.toggleSorting(true);
			} else {
				column.clearSorting();
			}
		} else {
			column.toggleSorting();
		}
	}, [column, sortCycle]);

	const pinnedStyles = buildPinnedColumnStyles(isPinned, column.getStart(), column.getAfter(), 10);

	const handlePinClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>): void => {
			e.stopPropagation();
			onTogglePin(column.id);
		},
		[column, onTogglePin],
	);

	return (
		<TableHead
			style={pinnedStyles}
			className={cn(
				"h-11 bg-muted/30 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
				column.getCanSort() && "cursor-pointer hover:bg-muted/50",
				isPinned && "sticky",
			)}
			onClick={handleHeaderClick}>
			{/* Sort icon sits right after the label (shrink-0) so it never gets pushed
			    to the right edge by a wide header child or a stretched column. */}
			<div className="flex w-full items-center gap-1.5">
				{header.isPlaceholder ? null : flexRender(column.columnDef.header, header.getContext())}
				{column.getCanSort() ? <span className="flex shrink-0 items-center">{getSortIcon(column)}</span> : null}

				{/* NEW FEATURE 5: Pin indicator */}
				{enableColumnPinning && column.getCanPin() ? (
					<button
						onClick={handlePinClick}
						className="ml-1 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
						title={column.getIsPinned() ? "Unpin column" : "Pin column"}>
						{column.getIsPinned() ? <PinOff className="h-3 w-3 text-muted-foreground" /> : <Pin className="h-3 w-3 text-muted-foreground" />}
					</button>
				) : null}
			</div>
		</TableHead>
	);
});

// ── Table Cell (sub-component: the per-cell edit closures live here) ─────────

interface TableCellViewProps<TData extends RowData> {
	readonly cell: Cell<DataTableFeatures, TData>;
	readonly rowIdx: number;
	readonly editableSet: ReadonlySet<string>;
	readonly editingCell: EditingCell | null;
	readonly onCellDoubleClick: (rowIndex: number, columnId: string) => void;
	readonly onCellEditSave: (rowIndex: number, columnId: string, value: string, row: TData) => void;
	readonly onCellEditCancel: () => void;
}

const TableCellView = memoGeneric(function TableCellView<TData extends RowData>({
	cell,
	rowIdx,
	editableSet,
	editingCell,
	onCellDoubleClick,
	onCellEditSave,
	onCellEditCancel,
}: TableCellViewProps<TData>): React.JSX.Element {
	const column = cell.column;
	const isPinned = column.getIsPinned();
	const cellId = column.id;
	const isEditing = editingCell !== null && editingCell.rowIndex === rowIdx && editingCell.columnId === cellId;

	const pinnedStyles = buildPinnedColumnStyles(isPinned, column.getStart(), column.getAfter(), 5);

	const handleCellDblClick = useCallback((): void => {
		onCellDoubleClick(rowIdx, cellId);
	}, [onCellDoubleClick, rowIdx, cellId]);

	const handleCellSave = useCallback(
		(val: string): void => {
			onCellEditSave(rowIdx, cellId, val, cell.row.original);
		},
		[onCellEditSave, rowIdx, cellId, cell.row.original],
	);

	return (
		<TableCell
			key={cell.id}
			className={cn("p-4", editableSet.has(cellId) && !isEditing && "cursor-pointer hover:bg-muted/30", isPinned && "sticky")}
			style={pinnedStyles}
			onDoubleClick={handleCellDblClick}>
			{isEditing ? (
				<InlineEditInput value={cellValueDisplayString(cell)} onSave={handleCellSave} onCancel={onCellEditCancel} />
			) : (
				// w-full lets a column's own `text-end` cell content right-align;
				// without it the flex wrapper shrink-fits and text-end is a no-op.
				<div className="flex w-full items-center gap-1">
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
					{editableSet.has(cellId) ? <Pencil className="ml-1 h-3 w-3 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:opacity-100" /> : null}
				</div>
			)}
		</TableCell>
	);
});

// ── Table Row (sub-component: per-row click/drag/edit closures live here) ────

interface TableRowViewProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly rowIdx: number;
	readonly rowHeight?: number;
	// Selection highlight — supplied by the per-row `table.Subscribe` island,
	// because row objects are cached (stable identity) and `row.getIsSelected()`
	// would otherwise go stale inside the memoized row (bugfix #2).
	readonly isRowSelected: boolean;
	readonly draggable: boolean;
	readonly editableSet: ReadonlySet<string>;
	readonly editingCell: EditingCell | null;
	readonly dragIndex: number | null;
	readonly dragOverIndex: number | null;
	readonly onRowClick?: (row: TData) => void;
	readonly onDragStart: (e: React.DragEvent, index: number) => void;
	readonly onDragOver: (e: React.DragEvent, index: number) => void;
	readonly onDrop: (e: React.DragEvent, index: number) => void;
	readonly onDragEnd: () => void;
	readonly onCellDoubleClick: (rowIndex: number, columnId: string) => void;
	readonly onCellEditSave: (rowIndex: number, columnId: string, value: string, row: TData) => void;
	readonly onCellEditCancel: () => void;
}

const TableRowView = memoGeneric(function TableRowView<TData extends RowData>({
	row,
	rowIdx,
	rowHeight,
	isRowSelected,
	draggable,
	editableSet,
	editingCell,
	dragIndex,
	dragOverIndex,
	onRowClick,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onCellDoubleClick,
	onCellEditSave,
	onCellEditCancel,
}: TableRowViewProps<TData>): React.JSX.Element {
	const rowData = row.original;
	const isDragging = dragIndex === rowIdx;
	const isDragOver = dragOverIndex === rowIdx;

	const handleRowClick = useCallback((): void => {
		onRowClick?.(rowData);
	}, [onRowClick, rowData]);

	const handleRowKeyDown = useCallback(
		(e: React.KeyboardEvent): void => {
			if (e.key === "Enter" || e.key === " ") {
				onRowClick?.(rowData);
			}
		},
		[onRowClick, rowData],
	);

	const handleRowDragStart = useCallback(
		(e: React.DragEvent): void => {
			onDragStart(e, rowIdx);
		},
		[onDragStart, rowIdx],
	);

	const handleRowDragOver = useCallback(
		(e: React.DragEvent): void => {
			onDragOver(e, rowIdx);
		},
		[onDragOver, rowIdx],
	);

	const handleRowDrop = useCallback(
		(e: React.DragEvent): void => {
			onDrop(e, rowIdx);
		},
		[onDrop, rowIdx],
	);

	const rowStyle = useMemo((): React.CSSProperties | undefined => {
		return rowHeight !== undefined ? { height: rowHeight } : undefined;
	}, [rowHeight]);

	const rowInteractionProps = useMemo((): Partial<React.ComponentProps<typeof TableRow>> => {
		if (onRowClick === undefined) {
			return {};
		}
		return {
			onClick: handleRowClick,
			role: "button",
			tabIndex: 0,
			onKeyDown: handleRowKeyDown,
		};
	}, [onRowClick, handleRowClick, handleRowKeyDown]);

	const rowDragProps = useMemo((): Partial<React.ComponentProps<typeof TableRow>> => {
		if (!draggable) {
			return {};
		}
		return {
			draggable: true,
			onDragStart: handleRowDragStart,
			onDragOver: handleRowDragOver,
			onDrop: handleRowDrop,
			onDragEnd,
		};
	}, [draggable, handleRowDragStart, handleRowDragOver, handleRowDrop, onDragEnd]);

	return (
		<TableRow
			key={row.id}
			data-state={isRowSelected ? "selected" : null}
			style={rowStyle}
			className={cn(
				rowHeight !== undefined ? undefined : "h-18",
				draggable && "transition-opacity",
				isDragging && "opacity-50",
				isDragOver && "border-t-2 border-t-primary",
				onRowClick && "cursor-pointer hover:bg-muted/50",
			)}
			{...rowInteractionProps}
			{...rowDragProps}>
			{row.getVisibleCells().map((cell) => (
				<TableCellView
					key={cell.id}
					cell={cell}
					rowIdx={rowIdx}
					editableSet={editableSet}
					editingCell={editingCell}
					onCellDoubleClick={onCellDoubleClick}
					onCellEditSave={onCellEditSave}
					onCellEditCancel={onCellEditCancel}
				/>
			))}
		</TableRow>
	);
});

// ── Mobile Card (sub-component: per-row click/selection closures live here) ──

interface MobileCardViewProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly enableBulkSelection: boolean;
	readonly mobileCardRender: (item: TData, actions?: Action<TData>[]) => React.ReactNode;
	readonly actions: Action<TData>[];
	readonly labels: DataTableLabels;
	readonly onAnyDeselect: () => void;
	readonly onRowClick?: (row: TData) => void;
}

const MobileCardView = memoGeneric(function MobileCardView<TData extends RowData>({
	row,
	table,
	enableBulkSelection,
	mobileCardRender,
	actions,
	labels,
	onAnyDeselect,
	onRowClick,
}: MobileCardViewProps<TData>): React.JSX.Element {
	const rowData = row.original;

	const handleCardClick = useCallback((): void => {
		onRowClick?.(rowData);
	}, [onRowClick, rowData]);

	const handleCardKeyDown = useCallback(
		(e: React.KeyboardEvent): void => {
			if (e.key === "Enter" || e.key === " ") {
				onRowClick?.(rowData);
			}
		},
		[onRowClick, rowData],
	);

	const cardInteractionProps = useMemo((): Partial<React.ComponentProps<"div">> => {
		if (onRowClick === undefined) {
			return {};
		}
		return {
			onClick: handleCardClick,
			role: "button",
			tabIndex: 0,
			onKeyDown: handleCardKeyDown,
		};
	}, [onRowClick, handleCardClick, handleCardKeyDown]);

	return (
		<div key={row.id} className="flex items-start gap-3" {...cardInteractionProps}>
			{enableBulkSelection ? <SelectRowCheckbox row={row} table={table} onAnyDeselect={onAnyDeselect} labels={labels} className="mt-4" /> : null}
			<div className="flex-1">{mobileCardRender(rowData, actions)}</div>
		</div>
	);
});

// ── Skeleton Row (loading placeholder — rendered while `isLoading`) ─────────

interface SkeletonRowProps {
	readonly cells: number;
	readonly height?: number;
}

const SkeletonRow = React.memo(function SkeletonRow({ cells, height }: SkeletonRowProps): React.JSX.Element {
	const skeletonStyle = useMemo((): React.CSSProperties | undefined => {
		return height !== undefined ? { height } : undefined;
	}, [height]);

	return (
		<TableRow>
			{Array.from({ length: cells }, (_, index) => (
				<TableCell key={index} className="p-4">
					<div className="h-4 animate-pulse rounded-md bg-muted" style={skeletonStyle} />
				</TableCell>
			))}
		</TableRow>
	);
});

// ── Bulk Selection Bar (shared by the desktop banner + mobile bar) ──────────

interface BulkSelectionBarProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly bulkActions: BulkAction<TData>[];
	readonly selectedRows: TData[];
	readonly selectAllPages: boolean;
	readonly totalFilteredRows: number;
	readonly labels: DataTableLabels;
	readonly onAnyDeselect: () => void;
	readonly onBulkActionDone: () => void;
	readonly onClearSelection: () => void;
	readonly compact?: boolean;
}

const BulkSelectionBar = memoGeneric(function BulkSelectionBar<TData extends RowData>({
	table,
	bulkActions,
	selectedRows,
	selectAllPages,
	totalFilteredRows,
	labels,
	onAnyDeselect,
	onBulkActionDone,
	onClearSelection,
	compact = false,
}: BulkSelectionBarProps<TData>): React.JSX.Element {
	return (
		<div className={cn("mb-4 rounded-lg border p-3 sm:p-4", compact ? "border-border bg-muted/50" : "border-info/30 bg-info-soft dark:border-info/30 dark:bg-info-soft")}>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-2">
					<SelectAllCheckbox table={table} onAnyDeselect={onAnyDeselect} labels={labels} />
					<span className={cn("text-sm font-medium", compact ? "text-foreground" : "text-blue-900 dark:text-blue-100")}>
						{selectAllPages ? (
							<>{formatDataTableLabel(labels.allRowsSelected, { totalCount: totalFilteredRows })}</>
						) : selectedRows.length === 1 ? (
							<>{labels.selectedRowCount}</>
						) : (
							<>{formatDataTableLabel(labels.selectedRowsCount, { count: selectedRows.length })}</>
						)}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{bulkActions.map((action) => (
						<BulkActionButton key={action.key} action={action} selectedRows={selectedRows} onDone={onBulkActionDone} />
					))}
					<Button variant="ghost" size="sm" onClick={onClearSelection} className="shrink-0 text-xs sm:text-sm">
						{labels.clearSelection}
					</Button>
				</div>
			</div>
		</div>
	);
});

// ── DataTable Component ────────────────────────────────────────────────────

export function DataTable<TData extends RowData>({
	ref,
	// Core
	data,
	columns: initialColumns,
	filters = EMPTY_FILTERS,
	actions = EMPTY_ACTIONS,
	searchKeys = EMPTY_SEARCH_KEYS,
	pageSize = 10,
	pageSizeOptions,
	title,
	description,

	// Responsive
	mobileCardRender,

	// Bulk selection
	enableBulkSelection = false,
	bulkActions = EMPTY_BULK_ACTIONS,

	// Empty state
	emptyState,

	// Appearance
	className,

	// NEW FEATURE 1: Row click
	onRowClick,

	// NEW FEATURE 2: Column visibility
	enableColumnVisibility = false,

	// NEW FEATURE 3: CSV export
	exportable = false,
	exportFilename,
	exportableColumns,

	// NEW FEATURE 4: Preference persistence
	persistKey,
	storage,

	// Bulk selection: cross-page select-all
	selectAllPages: selectAllPagesProp,
	onSelectAllPagesChange,

	// NEW FEATURE 5: Column pinning
	enableColumnPinning = false,

	// NEW FEATURE 6: Server-side mode
	manual = false,
	totalCount,
	onManualPaginationChange,

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
	skeletonRows = 5,
	error,

	// Robustness: Sort cycle
	sortCycle = "asc-desc",

	labels,
}: DataTableProps<TData>): React.JSX.Element {
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

	const [persistedPrefs] = useState<DataTablePersistedPrefs | null>(() => {
		if (persistKey === undefined || resolvedStorage === null) {
			return null;
		}
		return resolvedStorage.read(persistKey);
	});

	const [sorting, setSorting] = useState<SortingState>(() => persistedPrefs?.sorting ?? []);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: persistedPrefs?.pageSize ?? pageSize,
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
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => persistedPrefs?.columnVisibility ?? EMPTY_COLUMN_VISIBILITY);

	// NEW FEATURE 5: Column pinning state (v9: start/end arrays, not a flat map)
	const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => ({
		start: persistedPrefs?.columnPinning?.start ?? EMPTY_COLUMN_PINNING.start,
		end: persistedPrefs?.columnPinning?.end ?? EMPTY_COLUMN_PINNING.end,
	}));

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
				id: "drag",
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
		if (enableBulkSelection) {
			cols.push({
				id: "select",
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
				id: "actions",
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

		return cols;
	}, [initialColumns, actions, labels, enableBulkSelection, draggable, handleAnyDeselect]);

	// ── Editable Columns Set ────────────────────────────────────────────
	const editableSet = useMemo<ReadonlySet<string>>(() => {
		if (!editable || !editableColumns) return new Set<string>();
		return new Set(editableColumns);
	}, [editable, editableColumns]);

	// ── Table instance ─────────────────────────────────────────────────
	const pageCount = manual && totalCount !== undefined ? Math.ceil(totalCount / pagination.pageSize) : undefined;

	// Mirror of `pagination` for the manual-mode notification callback. The
	// handler below is memoized with a stable identity (it feeds TanStack's
	// `onPaginationChange`), so an updater-function must resolve its next state
	// against a ref rather than a stale closure. Written in an effect — refs
	// cannot be mutated during render under React 19.
	const paginationRef = useRef<PaginationState>(pagination);
	useEffect((): void => {
		paginationRef.current = pagination;
	}, [pagination]);

	// Sorting is loaded from persisted prefs, so writes go through this
	// handler to keep the round-trip symmetric (persistKey is opt-in).
	const handleSortingChange = useCallback(
		(updater: SortingState | ((prev: SortingState) => SortingState)): void => {
			const next = typeof updater === "function" ? updater(sorting) : updater;
			setSorting(next);
			// A new sort order invalidates the virtual scroll offset.
			setScrollTop(0);
			persistPreferences({ sorting: next });
		},
		[sorting, persistPreferences],
	);

	// Pagination also invalidates the virtual scroll offset (same reason).
	const handlePaginationChange = useCallback(
		(updater: PaginationState | ((prev: PaginationState) => PaginationState)): void => {
			setPagination(updater);
			setScrollTop(0);
			// Server-side mode: the consumer owns the data, so the pager must
			// round-trip through it — report the page + size to fetch (1-based).
			if (manual) {
				const next: PaginationState = typeof updater === "function" ? updater(paginationRef.current) : updater;
				onManualPaginationChange?.(next.pageIndex + 1, next.pageSize);
			}
		},
		[manual, onManualPaginationChange],
	);

	// Pinning changes flow through this handler so persistence mirrors the
	// sorting/visibility pattern (v9's `table.state` is intentionally opaque).
	const handlePinningChange = useCallback(
		(updater: ColumnPinningState | ((prev: ColumnPinningState) => ColumnPinningState)): void => {
			const next = typeof updater === "function" ? updater(columnPinning) : updater;
			setColumnPinning(next);
			persistPreferences({ columnPinning: next });
		},
		[columnPinning, persistPreferences],
	);

	// The options object is memoized so the `table` wrapper keeps a stable
	// identity between state changes — that is what lets the memoized leaf
	// sub-components (rows, headers, menus, pager) skip re-rendering.
	const tableOptions = useMemo<TableOptions<DataTableFeatures, TData>>(
		() => ({
			features: dataTableFeatures,
			data,
			columns,
			state: { sorting, columnFilters, globalFilter, pagination, columnVisibility, columnPinning },
			onSortingChange: handleSortingChange,
			onColumnFiltersChange: setColumnFilters,
			onGlobalFilterChange: setGlobalFilter,
			onPaginationChange: handlePaginationChange,
			onColumnVisibilityChange: setColumnVisibility,
			onColumnPinningChange: handlePinningChange,
			enableRowSelection: enableBulkSelection,
			enableColumnPinning,
			manualPagination: manual,
			manualSorting: manual,
			manualFiltering: manual,
			pageCount,
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
			sorting,
			columnFilters,
			globalFilter,
			pagination,
			columnVisibility,
			columnPinning,
			handleSortingChange,
			handlePaginationChange,
			handlePinningChange,
			enableBulkSelection,
			enableColumnPinning,
			manual,
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

	const handleFilterChange = useCallback(
		(filterKey: string, value: string | null): void => {
			setScrollTop(0);
			if (value === "all" || value === null) {
				table.getColumn(filterKey)?.setFilterValue(undefined);
			} else {
				table.getColumn(filterKey)?.setFilterValue(value);
			}
		},
		[table],
	);

	const getFilterValue = useCallback(
		(filterKey: string): string => {
			const filterValue = table.getColumn(filterKey)?.getFilterValue();
			const parsed = DataTableCellScalarSchema.safeParse(filterValue);
			return parsed.success ? String(parsed.data) : "all";
		},
		[table],
	);

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
	const isEmptyData = data.length === 0;
	const isEmptyFiltered = useMemo(() => table.getRowModel().rows.length === 0 && !isEmptyData, [table, isEmptyData]);

	// The pager is always rendered when there are rows (compulsory), but an
	// empty row set shows one of the Empty states instead — a "Showing 1 to 0
	// of 0 results" bar under an empty table would be noise, not information.
	const pagerRowCount = manual && totalCount !== undefined ? totalCount : table.getFilteredRowModel().rows.length;

	const totalFilteredRows = useMemo(() => table.getFilteredRowModel().rows.length, [table]);

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

	const handleClearSearch = useCallback((): void => {
		setSearchInput("");
		setScrollTop(0);
		if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
		setGlobalFilter("");
	}, []);

	const handleClearFilters = useCallback((): void => {
		setSearchInput("");
		setScrollTop(0);
		if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
		setGlobalFilter("");
		table.resetColumnFilters();
	}, [table]);

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
			table.setPageSize(size);
			persistPreferences({ pageSize: size });
		},
		[table, persistPreferences],
	);

	const handleFirstPage = useCallback((): void => {
		setScrollTop(0);
		table.setPageIndex(0);
	}, [table]);

	const handlePreviousPage = useCallback((): void => {
		setScrollTop(0);
		table.previousPage();
	}, [table]);

	const handleNextPage = useCallback((): void => {
		setScrollTop(0);
		table.nextPage();
	}, [table]);

	const handleLastPage = useCallback((): void => {
		setScrollTop(0);
		table.setPageIndex(table.getPageCount() - 1);
	}, [table]);

	const handlePageSelect = useCallback(
		(pageNumber: number): void => {
			setScrollTop(0);
			table.setPageIndex(pageNumber - 1);
		},
		[table],
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
		const hasSelection = selectedData.length > 0;
		const allPageRowsSelected = table.getIsAllPageRowsSelected();
		const currentTotalFiltered = table.getFilteredRowModel().rows.length;
		const showSelectAllBanner = allPageRowsSelected && !selectAllPages && currentTotalFiltered > table.getRowModel().rows.length;

		return (
			<>
				{/* ── SELECT ALL BANNER ─────────────────────────────────── */}
				{showSelectAllBanner ? (
					<div className="mb-4 rounded-lg border border-info/30 bg-info-soft p-3 dark:border-info/30 dark:bg-info-soft">
						<p className="text-sm text-blue-900 dark:text-blue-100">
							{formatDataTableLabel(labels.selectAllPageRowsSelected, { pageCount: table.getRowModel().rows.length })}{" "}
							<button onClick={handleSelectAllPages} className="font-semibold underline hover:no-underline focus:outline-none">
								{formatDataTableLabel(labels.selectAllFilteredRows, { totalCount: currentTotalFiltered })}
							</button>
						</p>
					</div>
				) : null}

				{/* ── BULK ACTIONS BAR (desktop) ────────────────────────── */}
				{hasSelection && bulkActions.length > 0 ? (
					<div className="hidden lg:block">
						<BulkSelectionBar
							table={table}
							bulkActions={bulkActions}
							selectedRows={selectedData}
							selectAllPages={selectAllPages}
							totalFilteredRows={currentTotalFiltered}
							labels={labels}
							onAnyDeselect={handleAnyDeselect}
							onBulkActionDone={handleBulkActionDone}
							onClearSelection={handleClearSelection}
						/>
					</div>
				) : null}

				{/* ── MOBILE SELECTION BAR ──────────────────────────────── */}
				{hasSelection && bulkActions.length > 0 && enableBulkSelection && mobileCardRender ? (
					<div className="lg:hidden">
						<BulkSelectionBar
							table={table}
							bulkActions={bulkActions}
							selectedRows={selectedData}
							selectAllPages={selectAllPages}
							totalFilteredRows={currentTotalFiltered}
							labels={labels}
							onAnyDeselect={handleAnyDeselect}
							onBulkActionDone={handleBulkActionDone}
							onClearSelection={handleClearSelection}
							compact
						/>
					</div>
				) : null}
			</>
		);
	}, [selectAllPages, table, bulkActions, enableBulkSelection, mobileCardRender, labels, handleAnyDeselect, handleBulkActionDone, handleClearSelection, handleSelectAllPages]);

	const filterFacetedCounts = useMemo((): Record<string, ReadonlyMap<string, number>> => {
		const counts: Record<string, ReadonlyMap<string, number>> = {};
		for (const filter of filters) {
			const facetedRaw = table.getColumn(filter.key)?.getFacetedUniqueValues();
			counts[filter.key] = normalizeFacetedUniqueValues(facetedRaw ?? undefined);
		}
		return counts;
	}, [filters, table]);

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
				{/* Search + column filters are client-side — hidden in `manual`
				    (server-side) mode because the consumer owns filtering. */}
				{(!manual && (searchKeys.length > 0 || filters.length > 0)) || enableColumnVisibility || exportable ? (
					<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
						{/* Search (with clear button + live result count) */}
						{!manual && searchKeys.length > 0 ? (
							<div className="relative flex-1 sm:max-w-64">
								<Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									aria-label={labels.searchAriaLabel}
									placeholder={labels.searchPlaceholder}
									value={searchInput}
									onChange={handleSearchChange}
									className="h-9 pr-8 pl-8 text-sm"
								/>
								{searchInput !== "" ? (
									<button
										type="button"
										onClick={handleClearSearch}
										aria-label={labels.clearSearchAriaLabel}
										className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground">
										<X className="h-4 w-4" />
									</button>
								) : null}
							</div>
						) : null}

						{/* Column filters (with faceted counts) */}
						{!manual
							? filters.map((filter) => (
									<ColumnFilterSelect
										key={filter.key}
										filter={filter}
										value={getFilterValue(filter.key)}
										totalFilteredRows={totalFilteredRows}
										facetedCounts={filterFacetedCounts[filter.key] ?? EMPTY_FACETED_COUNTS}
										onFilterChange={handleFilterChange}
									/>
								))
							: null}

						{/* Live result count (search or a column filter is active) */}
						{!manual && (searchInput !== "" || columnFilters.length > 0) ? (
							<span className="text-xs whitespace-nowrap text-muted-foreground">
								{formatDataTableLabel(labels.resultsCount, { filtered: totalFilteredRows, total: data.length })}
							</span>
						) : null}

						<div className="mt-1 flex items-center gap-2 sm:mt-0 sm:ml-auto">
							{exportable ? <ExportMenu table={table} columns={columns} exportFilename={exportFilename} exportableColumns={exportableColumns} labels={labels} /> : null}

							{enableColumnVisibility ? (
								<ColumnVisibilityMenu table={table} columnVisibility={columnVisibility} onVisibilityChange={handleVisibilityChange} labels={labels} />
							) : null}
						</div>
					</div>
				) : null}

				{/* ── MAIN CONTENT ────────────────────────────────────────── */}
				{error !== undefined && error !== null && error !== "" ? (
					<div className="my-8 flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-8 text-center">
						<CircleAlert className="h-6 w-6 text-destructive" />
						<p className="text-sm font-medium text-destructive">{error}</p>
					</div>
				) : isLoading ? (
					<div className="hidden overflow-x-auto rounded-md border lg:block">
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
				) : isEmptyData ? (
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
						{mobileCardRender ? (
							<div className="space-y-4 lg:hidden">
								{isEmptyFiltered ? (
									<Empty>
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<Search className="h-6 w-6" />
											</EmptyMedia>
											<EmptyTitle>{labels.noResultsTitle}</EmptyTitle>
											<EmptyDescription>{labels.noResultsDescription}</EmptyDescription>
										</EmptyHeader>
										<EmptyContent>
											<Button variant="outline" onClick={handleClearFilters}>
												{labels.clearFilters}
											</Button>
										</EmptyContent>
									</Empty>
								) : (
									table
										.getRowModel()
										.rows.map((row) => (
											<MobileCardView
												key={row.id}
												row={row}
												table={table}
												enableBulkSelection={enableBulkSelection}
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
						<div
							className={cn("hidden rounded-md border lg:block", virtualizeRows ? "overflow-auto" : "overflow-x-auto")}
							style={desktopTableScrollStyle}
							onScroll={virtualizeRows ? handleVirtualScroll : undefined}>
							<Table>
								<TableHeader>
									{table.getHeaderGroups().map((headerGroup) => (
										<TableRow key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<HeaderCell key={header.id} header={header} enableColumnPinning={enableColumnPinning} sortCycle={sortCycle} onTogglePin={togglePin} />
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
												<Empty>
													<EmptyHeader>
														<EmptyMedia variant="icon">
															<Search className="h-6 w-6" />
														</EmptyMedia>
														<EmptyTitle>{labels.noResultsTitle}</EmptyTitle>
														<EmptyDescription>{labels.noResultsDescription}</EmptyDescription>
													</EmptyHeader>
													<EmptyContent>
														<Button variant="outline" onClick={handleClearFilters}>
															{labels.clearFilters}
														</Button>
													</EmptyContent>
												</Empty>
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>

						{/* ── PAGINATION (always visible when there are rows — the pager is
						    a core part of every data table, even when the data fits on one
						    page; the page-number strip is only hidden on a single page.
						    With an empty row set the Empty states already communicate the
						    case, so the pager is skipped.) ── */}
						{pagerRowCount > 0 ? (
							<div className="flex flex-col items-center justify-center gap-6 py-6 sm:flex-row md:justify-center lg:justify-between">
								<div className="flex items-center gap-4">
									<div className="text-sm text-muted-foreground">
										{formatDataTableLabel(labels.showingResults, {
											from: table.state.pagination.pageIndex * table.state.pagination.pageSize + 1,
											to: Math.min(
												(table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
												manual && totalCount !== undefined ? totalCount : table.getFilteredRowModel().rows.length,
											),
											total: manual && totalCount !== undefined ? totalCount : table.getFilteredRowModel().rows.length,
										})}
									</div>
								</div>
								<div className="flex items-center space-x-4">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">{labels.showPerPage}</span>
										<PageSizeSelect pageSize={table.state.pagination.pageSize} options={finalPageSizeOptions} onPageSizeChange={handlePageSizeChange} />
										<span className="text-sm text-muted-foreground">{labels.perPage}</span>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Button variant="outline" size="sm" onClick={handleFirstPage} disabled={!table.getCanPreviousPage()} aria-label={labels.firstPageAriaLabel}>
										<ChevronsLeft className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!table.getCanPreviousPage()} aria-label={labels.previousPageAriaLabel}>
										<ChevronLeft className="h-4 w-4" />
									</Button>{" "}
									{table.getPageCount() > 1 ? (
										<div className="flex items-center gap-1">
											{Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
												let pageNumber: number;
												const currentPage = table.state.pagination.pageIndex + 1;
												const totalPages = table.getPageCount();

												if (totalPages <= 5) {
													pageNumber = i + 1;
												} else if (currentPage <= 3) {
													pageNumber = i + 1;
												} else if (currentPage >= totalPages - 2) {
													pageNumber = totalPages - 4 + i;
												} else {
													pageNumber = currentPage - 2 + i;
												}

												return <PageNumberButton key={pageNumber} pageNumber={pageNumber} currentPage={currentPage} onPageSelect={handlePageSelect} />;
											})}
										</div>
									) : null}
									<Button variant="outline" size="sm" onClick={handleNextPage} disabled={!table.getCanNextPage()} aria-label={labels.nextPageAriaLabel}>
										<ChevronRight className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handleLastPage} disabled={!table.getCanNextPage()} aria-label={labels.lastPageAriaLabel}>
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
