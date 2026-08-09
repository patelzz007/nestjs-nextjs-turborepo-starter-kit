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
	filterFns,
	flexRender,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFns,
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

import { assumeType, cn } from "@workspace/ui/lib/utils";

// ── Generic-preserving memo ────────────────────────────────────────────────
// React's built-in `React.memo` collapses a generic component signature
// (`<TData extends RowData>(props: P<TData>) => JSX`) down to its constraint
// (`RowData`), which then breaks TanStack v9's invariant generics at every
// call site. This wrapper keeps the exact signature while still memoizing.
function memoGeneric<C extends (props: never) => React.JSX.Element>(Component: C): C {
	const memoized = React.memo(Component);
	assumeType<C>(memoized);
	return memoized;
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
	// Built-in fn registries (keeps string `filterFn`/`sortFn`/`globalFilterFn` typed).
	filterFns,
	sortFns,
});

/** The inferred feature type — used to type `ColumnDef<DataTableFeatures, TData>`. */
export type DataTableFeatures = typeof dataTableFeatures;

/** Default row height (px) for row virtualization — matches the `h-18` row class. */
const DEFAULT_ROW_HEIGHT = 72;

/** Rows rendered above/below the visible band while virtualizing. */
const VIRTUAL_OVERSCAN = 6;

/** Default page-size options when `pageSizeOptions` is not provided. */
const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 50, 100];

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

// ── DataTable Props ────────────────────────────────────────────────────────

export interface DataTableProps<TData extends RowData> {
	// Core
	readonly data: TData[];
	readonly columns: ColumnDef<DataTableFeatures, TData>[];
	readonly filters?: Filter[];
	readonly actions?: Action<TData>[];
	readonly searchKeys?: string[];
	readonly pageSize?: number;
	readonly pageSizeOptions?: number[];
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

	// ── NEW FEATURE 4: LocalStorage preferences ───────────────────────────
	readonly persistKey?: string;

	// ── NEW FEATURE 5: Column pinning ──────────────────────────────────────
	readonly enableColumnPinning?: boolean;

	// ── NEW FEATURE 6: Server-side mode ───────────────────────────────────
	readonly manual?: boolean;
	readonly totalCount?: number;

	// ── NEW FEATURE 7: Inline editing ─────────────────────────────────────
	readonly editable?: boolean;
	readonly editableColumns?: string[];
	// The `row` original is passed alongside the index so consumers can map the
	// edit back to the record by stable id — indices alone are unreliable once
	// sorting, filtering or pagination re-orders the row model.
	readonly onCellEdit?: (rowIndex: number, columnId: string, value: unknown, row: TData) => void;

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
}

// ── Editable Cell ──────────────────────────────────────────────────────────

interface EditingCell {
	readonly rowIndex: number;
	readonly columnId: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Safe stringification for cell values — objects become JSON, never `[object Object]`. */
function toCellString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
	// JSON.stringify returns `undefined` for functions/symbols — `|| ""` is the fallback.
	return JSON.stringify(value) || "";
}

/**
 * Escapes a cell value for CSV/Spreadsheet exports so spreadsheet apps do not
 * evaluate it as a formula. Cells starting with `=`, `+`, `-`, `@` (or a tab /
 * CR) get a leading apostrophe — the standard CSV injection guard.
 */
export function sanitizeExportCell(value: unknown): string {
	const str = toCellString(value);
	return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/** The persisted preference shape (kept loose — re-validated at use sites). */
interface PersistedPrefs {
	readonly columnVisibility?: ColumnVisibilityState;
	readonly pageSize?: number;
	readonly sorting?: SortingState;
	readonly columnPinning?: ColumnPinningState;
}

/** Reads + safely parses the `datatable:<persistKey>` localStorage entry. */
function readPersistedPrefs(persistKey: string | undefined): PersistedPrefs | null {
	if (persistKey === undefined || typeof window === "undefined") return null;
	try {
		const saved = window.localStorage.getItem(`datatable:${persistKey}`);
		if (saved === null) return null;
		const parsed: unknown = JSON.parse(saved);
		assumeType<PersistedPrefs>(parsed);
		return parsed;
	} catch {
		return null;
	}
}

function getSortIcon<TData extends RowData>(column: Column<DataTableFeatures, TData>): React.JSX.Element {
	const sorted = column.getIsSorted();
	if (sorted === "asc") return <ArrowUp className="h-4 w-4" />;
	if (sorted === "desc") return <ArrowDown className="h-4 w-4" />;
	return <ArrowUpDown className="h-4 w-4" />;
}

/** Builds the CSV header row, excluding utility columns (select/drag/actions). */
function buildExportColumns<TData extends RowData>(
	columns: ColumnDef<DataTableFeatures, TData>[],
	extra: readonly string[] = ["select", "actions", "drag"],
): ColumnDef<DataTableFeatures, TData>[] {
	return columns.filter((col) => {
		const key = "id" in col ? String(col.id) : "accessorKey" in col ? String(col.accessorKey) : undefined;
		return key !== undefined && !extra.includes(key);
	});
}

function exportToCSV<TData extends RowData>(data: TData[], columns: ColumnDef<DataTableFeatures, TData>[], filename = "export.csv"): void {
	if (data.length === 0) return;

	// Build CSV header from column ids
	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) {
				return String(col.id);
			}
			if ("accessorKey" in col) {
				return String(col.accessorKey);
			}
			return undefined;
		})
		.filter((id): id is string => id !== undefined && id !== "select" && id !== "actions");

	const csvRows = [headers.join(",")];
	for (const row of data) {
		const values = headers.map((header) => {
			const rowRecord = row;
			assumeType<Record<string, unknown>>(rowRecord);
			const str = sanitizeExportCell(rowRecord[header]);
			// Escape quotes and wrap in quotes if contains comma or quote
			return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
		});
		csvRows.push(values.join(","));
	}

	const csv = csvRows.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function exportToJSON<TData extends RowData>(rows: TData[], columns: ColumnDef<DataTableFeatures, TData>[], filename: string): void {
	const jsonData = rows.map((row) => {
		const rowRecord = row;
		assumeType<Record<string, unknown>>(rowRecord);
		const obj: Record<string, unknown> = {};
		for (const col of columns) {
			const key = "id" in col ? String(col.id) : "accessorKey" in col ? String(col.accessorKey) : undefined;
			if (key !== undefined) {
				obj[key] = rowRecord[key];
			}
		}
		return obj;
	});
	const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

/** Escapes XML text content for the SpreadsheetML document. */
function escapeXml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Emits a real SpreadsheetML 2003 document (`.xls`) — a plain-text XML format
 * Excel opens natively, no zip/deflate needed. The old implementation wrote
 * CSV bytes with an `.xlsx` extension, which Excel refused to open.
 */
export function exportToSpreadsheet<TData extends RowData>(rows: TData[], columns: ColumnDef<DataTableFeatures, TData>[], filename: string): void {
	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) return String(col.id);
			if ("accessorKey" in col) return String(col.accessorKey);
			return undefined;
		})
		.filter((id): id is string => id !== undefined);

	const rowXml = (values: readonly string[]): string =>
		`<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(sanitizeExportCell(value))}</Data></Cell>`).join("")}</Row>`;

	const bodyXml = [
		rowXml(headers),
		...rows.map((row) => {
			const rowRecord = row;
			assumeType<Record<string, unknown>>(rowRecord);
			return rowXml(headers.map((header) => toCellString(rowRecord[header])));
		}),
	].join("");

	const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
<Worksheet ss:Name="Data">
<Table>${bodyXml}</Table>
</Worksheet>
</Workbook>`;

	const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.xls`;
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * Exports the given rows as a print-ready PDF. Renders ONLY the table
 * (headers + rows, inline styles) into a hidden `srcdoc` iframe and triggers
 * the browser's print dialog on that frame — no page chrome, no other UI, and
 * no popup blocker (unlike the old `window.print()` which dumped the whole
 * page). Falls back to a bare `window.print()` if frames are unavailable.
 */
export function exportToPDF<TData extends RowData>(rows: TData[], columns: ColumnDef<DataTableFeatures, TData>[], filename: string): void {
	const headers = columns
		.map((col): string | undefined => {
			if ("id" in col) return String(col.id);
			if ("accessorKey" in col) return String(col.accessorKey);
			return undefined;
		})
		.filter((id): id is string => id !== undefined);

	const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

	const headerRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
	const bodyRows = rows
		.map((row) => {
			const rowRecord = row;
			assumeType<Record<string, unknown>>(rowRecord);
			const cells = headers.map((header) => `<td>${escapeHtml(toCellString(rowRecord[header]))}</td>`).join("");
			return `<tr>${cells}</tr>`;
		})
		.join("");

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(filename)}</title>
<style>
	* { box-sizing: border-box; }
	body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1f2937; }
	h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem; }
	table { border-collapse: collapse; width: 100%; font-size: 0.8125rem; }
	th { background: #f3f4f6; font-weight: 600; text-align: left; }
	th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; }
	tr:nth-child(even) td { background: #f9fafb; }
	@media print { body { margin: 0.5in; } }
</style>
</head>
<body>
<h1>${escapeHtml(filename)}</h1>
<table>
<thead>${headerRow}</thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;

	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.setAttribute("title", "Print preview");
	frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
	frame.srcdoc = html;

	const onFrameLoad = (): void => {
		const frameWindow = frame.contentWindow;
		if (frameWindow === null) {
			// Frame blocked — degrade to printing the current page.
			window.print();
			return;
		}
		frameWindow.focus();
		frameWindow.print();
	};

	frame.addEventListener("load", onFrameLoad);
	document.body.appendChild(frame);
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
}

const SelectAllCheckbox = memoGeneric(function SelectAllCheckbox<TData extends RowData>({ table, onAnyDeselect }: SelectAllCheckboxProps<TData>): React.JSX.Element {
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
	const renderCheckbox = (): React.JSX.Element => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={handleCheckedChange} aria-label="Select all" />;
	return <Subscribe source={table.atoms.rowSelection}>{renderCheckbox}</Subscribe>;
});

interface SelectRowCheckboxProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly onAnyDeselect: () => void;
	readonly className?: string;
}

const SelectRowCheckbox = memoGeneric(function SelectRowCheckbox<TData extends RowData>({
	row,
	table,
	onAnyDeselect,
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
		<Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} aria-label="Select row" className={className} />
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
}

const RowActionsMenu = memoGeneric(function RowActionsMenu<TData extends RowData>({ row, actions }: RowActionsMenuProps<TData>): React.JSX.Element {
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
					<span className="sr-only">Open menu</span>
					<MoreHorizontal className="h-4 w-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64 p-2">
					<div className="mb-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">User Actions</div>
					{actions.map((action) => (
						<DropdownMenuItem
							key={action.key}
							data-action-key={action.key}
							onClick={handleActionClick}
							className={cn("flex cursor-pointer items-center gap-3 rounded-md p-3", action.className ?? "hover:bg-blue-50 dark:hover:bg-blue-900/20")}>
							<div className={cn("flex h-8 w-8 items-center justify-center rounded-full", action.iconBgColor ?? "bg-blue-100 dark:bg-blue-900")}>{action.icon}</div>
							<div className="flex flex-col">
								<span className={cn("font-medium", action.isDestructive === true ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white")}>{action.label}</span>
								{action.description !== undefined ? <span className="text-xs text-gray-500 dark:text-gray-400">{action.description}</span> : null}
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

const ExportMenu = memoGeneric(function ExportMenu<TData extends RowData>({ table, columns, exportFilename, exportableColumns }: ExportMenuProps<TData>): React.JSX.Element {
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
				<span>Export</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44 p-1.5">
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">Export as</div>
				<DropdownMenuItem onClick={handleExportCSV} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
						<FileDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">CSV</span>
						<span className="text-[10px] text-muted-foreground">Comma-separated values</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportJSON} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
						<FileDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">JSON</span>
						<span className="text-[10px] text-muted-foreground">JavaScript object notation</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportPDF} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
						<FileDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">PDF</span>
						<span className="text-[10px] text-muted-foreground">Portable document format</span>
					</div>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleExportSpreadsheet} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
						<FileDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-medium">Spreadsheet</span>
						<span className="text-[10px] text-muted-foreground">Excel-compatible .xls</span>
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
				<span>Columns</span>
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
	readonly uniqueValues: ReadonlyMap<unknown, number> | undefined;
	readonly onFilterChange: (filterKey: string, value: string | null) => void;
}

const ColumnFilterSelect = React.memo(function ColumnFilterSelect({
	filter,
	value,
	totalFilteredRows,
	uniqueValues,
	onFilterChange,
}: ColumnFilterSelectProps): React.JSX.Element {
	const items = useMemo(() => [{ value: "all", label: `All ${filter.label}` }, ...filter.options], [filter]);

	// Faceted counts come from the registered columnFacetingFeature — the count
	// for a value reflects the rows that remain after the OTHER active filters.
	const countMap = useMemo((): ReadonlyMap<string, number> => {
		const map = new Map<string, number>();
		uniqueValues?.forEach((count, rawValue) => {
			map.set(toCellString(rawValue), count);
		});
		return map;
	}, [uniqueValues]);

	const handleValueChange = useCallback(
		(next: string | null): void => {
			onFilterChange(filter.key, next);
		},
		[filter, onFilterChange],
	);

	const labelFor = useCallback(
		(option: { readonly value: string; readonly label: string }): string => {
			const count = countMap.get(option.value);
			return count !== undefined ? `${option.label} (${String(count)})` : option.label;
		},
		[countMap],
	);

	return (
		<Select value={value} onValueChange={handleValueChange} items={items}>
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
	const items = useMemo(() => options.map((size) => ({ value: String(size), label: String(size) })), [options]);

	const handleValueChange = useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onPageSizeChange(Number(value));
			}
		},
		[onPageSizeChange],
	);

	return (
		<Select value={String(pageSize)} onValueChange={handleValueChange} items={items}>
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

	const pinnedStyles: React.CSSProperties = isPinned
		? {
				position: "sticky",
				left: isPinned === "start" ? `${String(column.getStart())}px` : undefined,
				right: isPinned === "end" ? `${String(column.getAfter())}px` : undefined,
				zIndex: 10,
				backgroundColor: "var(--color-card)",
				boxShadow: isPinned === "start" ? "2px 0 4px rgba(0,0,0,0.08)" : "-2px 0 4px rgba(0,0,0,0.08)",
			}
		: {};

	const handlePinClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>): void => {
			e.stopPropagation();
			onTogglePin(column.id);
		},
		[column, onTogglePin],
	);

	return (
		<TableHead style={pinnedStyles} className={cn("h-12 p-4", column.getCanSort() && "cursor-pointer hover:bg-muted/50", isPinned && "sticky")} onClick={handleHeaderClick}>
			<div className="flex items-center gap-2">
				{header.isPlaceholder ? null : flexRender(column.columnDef.header, header.getContext())}
				{column.getCanSort() ? getSortIcon(column) : null}

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

	const pinnedStyles: React.CSSProperties = isPinned
		? {
				position: "sticky",
				left: isPinned === "start" ? `${String(column.getStart())}px` : undefined,
				right: isPinned === "end" ? `${String(column.getAfter())}px` : undefined,
				zIndex: 5,
				backgroundColor: "var(--color-card)",
				boxShadow: isPinned === "start" ? "2px 0 4px rgba(0,0,0,0.08)" : "-2px 0 4px rgba(0,0,0,0.08)",
			}
		: {};

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
				<InlineEditInput value={toCellString(cell.getValue())} onSave={handleCellSave} onCancel={onCellEditCancel} />
			) : (
				<div className="flex items-center gap-1">
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

	return (
		<TableRow
			key={row.id}
			data-state={isRowSelected ? "selected" : null}
			style={rowHeight !== undefined ? { height: rowHeight } : undefined}
			className={cn(
				rowHeight !== undefined ? undefined : "h-18",
				draggable && "transition-opacity",
				isDragging && "opacity-50",
				isDragOver && "border-t-2 border-t-primary",
				onRowClick && "cursor-pointer hover:bg-muted/50",
			)}
			{...(onRowClick
				? {
						onClick: handleRowClick,
						role: "button",
						tabIndex: 0,
						onKeyDown: handleRowKeyDown,
					}
				: {})}
			{...(draggable
				? {
						draggable: true,
						onDragStart: handleRowDragStart,
						onDragOver: handleRowDragOver,
						onDrop: handleRowDrop,
						onDragEnd,
					}
				: {})}>
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
	readonly onAnyDeselect: () => void;
	readonly onRowClick?: (row: TData) => void;
}

const MobileCardView = memoGeneric(function MobileCardView<TData extends RowData>({
	row,
	table,
	enableBulkSelection,
	mobileCardRender,
	actions,
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

	return (
		<div
			key={row.id}
			className="flex items-start gap-3"
			{...(onRowClick
				? {
						onClick: handleCardClick,
						role: "button",
						tabIndex: 0,
						onKeyDown: handleCardKeyDown,
					}
				: {})}>
			{enableBulkSelection ? <SelectRowCheckbox row={row} table={table} onAnyDeselect={onAnyDeselect} className="mt-4" /> : null}
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
	return (
		<TableRow>
			{Array.from({ length: cells }, (_, index) => (
				<TableCell key={index} className="p-4">
					<div className="h-4 animate-pulse rounded-md bg-muted" style={height !== undefined ? { height } : undefined} />
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
	onAnyDeselect,
	onBulkActionDone,
	onClearSelection,
	compact = false,
}: BulkSelectionBarProps<TData>): React.JSX.Element {
	return (
		<div className={cn("mb-4 rounded-lg border p-3 sm:p-4", compact ? "border-border bg-muted/50" : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20")}>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-2">
					<SelectAllCheckbox table={table} onAnyDeselect={onAnyDeselect} />
					<span className={cn("text-sm font-medium", compact ? "text-foreground" : "text-blue-900 dark:text-blue-100")}>
						{selectAllPages ? (
							<>All {totalFilteredRows} rows selected</>
						) : (
							<>
								{selectedRows.length} row{selectedRows.length === 1 ? "" : "s"} selected
							</>
						)}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{bulkActions.map((action) => (
						<BulkActionButton key={action.key} action={action} selectedRows={selectedRows} onDone={onBulkActionDone} />
					))}
					<Button variant="ghost" size="sm" onClick={onClearSelection} className="shrink-0 text-xs sm:text-sm">
						Clear
					</Button>
				</div>
			</div>
		</div>
	);
});

// ── DataTable Component ────────────────────────────────────────────────────

export function DataTable<TData extends RowData>({
	// Core
	data,
	columns: initialColumns,
	filters = [],
	actions = [],
	searchKeys = [],
	pageSize = 10,
	pageSizeOptions,
	title,
	description,

	// Responsive
	mobileCardRender,

	// Bulk selection
	enableBulkSelection = false,
	bulkActions = [],

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

	// NEW FEATURE 4: LocalStorage persistence
	persistKey,

	// NEW FEATURE 5: Column pinning
	enableColumnPinning = false,

	// NEW FEATURE 6: Server-side mode
	manual = false,
	totalCount,

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
}: DataTableProps<TData>): React.JSX.Element {
	// ── State (persisted prefs load lazily once, from the initializer) ────
	const finalPageSizeOptions = useMemo(() => pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS, [pageSizeOptions]);

	const [persistedPrefs] = useState<PersistedPrefs | null>(() => readPersistedPrefs(persistKey));

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
	const [selectAllPages, setSelectAllPages] = useState(false);

	// NEW FEATURE 2: Column visibility state
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => persistedPrefs?.columnVisibility ?? {});

	// NEW FEATURE 5: Column pinning state (v9: start/end arrays, not a flat map)
	const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => persistedPrefs?.columnPinning ?? { start: [], end: [] });

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
		(updates: Record<string, unknown>): void => {
			if (persistKey === undefined || typeof window === "undefined") return;
			try {
				const key = `datatable:${persistKey}`;
				const existing = window.localStorage.getItem(key);
				const parsed: unknown = existing === null ? {} : JSON.parse(existing);
				assumeType<Record<string, unknown>>(parsed);
				const current = parsed;
				window.localStorage.setItem(key, JSON.stringify({ ...current, ...updates }));
			} catch {
				/* noop */
			}
		},
		[persistKey],
	);

	const handleAnyDeselect = useCallback((): void => {
		setSelectAllPages(false);
	}, []);

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
				header: ({ table }) => <SelectAllCheckbox table={table} onAnyDeselect={handleAnyDeselect} />,
				cell: ({ row, table }) => <SelectRowCheckbox row={row} table={table} onAnyDeselect={handleAnyDeselect} />,
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
				header: "Actions",
				cell: ({ row }) => <RowActionsMenu row={row} actions={actions} />,
				enableSorting: false,
				enableHiding: false,
				enablePinning: false,
				size: 80,
				minSize: 80,
				maxSize: 80,
			});
		}

		return cols;
	}, [initialColumns, actions, enableBulkSelection, draggable, handleAnyDeselect]);

	// ── Editable Columns Set ────────────────────────────────────────────
	const editableSet = useMemo<ReadonlySet<string>>(() => {
		if (!editable || !editableColumns) return new Set<string>();
		return new Set(editableColumns);
	}, [editable, editableColumns]);

	// ── Table instance ─────────────────────────────────────────────────
	const pageCount = manual && totalCount !== undefined ? Math.ceil(totalCount / pagination.pageSize) : undefined;

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
	const handlePaginationChange = useCallback((updater: PaginationState | ((prev: PaginationState) => PaginationState)): void => {
		setPagination(updater);
		setScrollTop(0);
	}, []);

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
				return searchKeys.some((key) => {
					const value = row.getValue(key);
					return toCellString(value).toLowerCase().includes(toCellString(filterValue).toLowerCase());
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
	// v9 types the `globalFilter` slice as `any`; we only ever store a string, so
	// coerce it through `toCellString` (accepts `unknown`) to keep the projection
	// free of `any` (rule 1) and the toolbar count re-render correct.
	const table = useTable(tableOptions, (state) => ({
		columnFilters: state.columnFilters,
		globalFilter: toCellString(state.globalFilter),
		pagination: state.pagination,
		sorting: state.sorting,
		columnVisibility: state.columnVisibility,
		columnPinning: state.columnPinning,
	}));

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
			return filterValue ? toCellString(filterValue) : "all";
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
	}, []);

	const handleBulkActionDone = useCallback((): void => {
		table.resetRowSelection();
		setSelectAllPages(false);
	}, [table]);

	const handleClearSelection = useCallback((): void => {
		table.resetRowSelection();
		setSelectAllPages(false);
	}, [table]);

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
					<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
						<p className="text-sm text-blue-900 dark:text-blue-100">
							All {table.getRowModel().rows.length} rows on this page are selected.{" "}
							<button onClick={handleSelectAllPages} className="font-semibold underline hover:no-underline focus:outline-none">
								Select all {currentTotalFiltered} rows
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
							onAnyDeselect={handleAnyDeselect}
							onBulkActionDone={handleBulkActionDone}
							onClearSelection={handleClearSelection}
							compact
						/>
					</div>
				) : null}
			</>
		);
	}, [selectAllPages, table, bulkActions, enableBulkSelection, mobileCardRender, handleAnyDeselect, handleBulkActionDone, handleClearSelection, handleSelectAllPages]);

	// ── Render ─────────────────────────────────────────────────────────
	return (
		<Card className={cn("w-full", className)}>
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
								<Input aria-label="Search rows" placeholder="Search..." value={searchInput} onChange={handleSearchChange} className="h-9 pr-8 pl-8 text-sm" />
								{searchInput !== "" ? (
									<button
										type="button"
										onClick={handleClearSearch}
										aria-label="Clear search"
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
										uniqueValues={table.getColumn(filter.key)?.getFacetedUniqueValues()}
										onFilterChange={handleFilterChange}
									/>
								))
							: null}

						{/* Live result count (search or a column filter is active) */}
						{!manual && (searchInput !== "" || columnFilters.length > 0) ? (
							<span className="text-xs whitespace-nowrap text-muted-foreground">
								{totalFilteredRows} of {data.length} results
							</span>
						) : null}

						<div className="mt-1 flex items-center gap-2 sm:mt-0 sm:ml-auto">
							{/* ── Multi-format Export Dropdown ────────────────── */}
							{exportable ? <ExportMenu table={table} columns={columns} exportFilename={exportFilename} exportableColumns={exportableColumns} /> : null}

							{/* ── Column visibility toggle ───────── */}
							{enableColumnVisibility ? <ColumnVisibilityMenu table={table} columnVisibility={columnVisibility} onVisibilityChange={handleVisibilityChange} /> : null}
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
											<TableHead key={header.id} className="h-12 p-4">
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
							<EmptyTitle>{emptyState?.title ?? "No data available"}</EmptyTitle>
							<EmptyDescription>{emptyState?.description ?? "Get started by adding your first item."}</EmptyDescription>
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
											<EmptyTitle>No results found</EmptyTitle>
											<EmptyDescription>Try adjusting your search or filter criteria to find what you&apos;re looking for.</EmptyDescription>
										</EmptyHeader>
										<EmptyContent>
											<Button variant="outline" onClick={handleClearFilters}>
												Clear filters
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
							style={virtualizeRows ? { maxHeight: maxHeight ?? DEFAULT_ROW_HEIGHT * 8 } : undefined}
							onScroll={virtualizeRows ? handleVirtualScroll : undefined}
							{...(draggable ? { onDragOver: handleTableDragOver } : {})}>
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
								<TableBody>
									{table.getRowModel().rows.length ? (
										<>
											{virtualizeRows && virtualStart > 0 ? <tr aria-hidden="true" style={{ height: virtualStart * effectiveRowHeight }} /> : null}
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
											{virtualizeRows && virtualEnd < rowCount ? <tr aria-hidden="true" style={{ height: (rowCount - virtualEnd) * effectiveRowHeight }} /> : null}
										</>
									) : (
										<TableRow>
											<TableCell colSpan={columns.length} className="h-64">
												<Empty>
													<EmptyHeader>
														<EmptyMedia variant="icon">
															<Search className="h-6 w-6" />
														</EmptyMedia>
														<EmptyTitle>No results found</EmptyTitle>
														<EmptyDescription>Try adjusting your search or filter criteria to find what you&apos;re looking for.</EmptyDescription>
													</EmptyHeader>
													<EmptyContent>
														<Button variant="outline" onClick={handleClearFilters}>
															Clear filters
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
										Showing {table.state.pagination.pageIndex * table.state.pagination.pageSize + 1} to{" "}
										{Math.min(
											(table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
											manual && totalCount !== undefined ? totalCount : table.getFilteredRowModel().rows.length,
										)}{" "}
										of {manual && totalCount !== undefined ? totalCount : table.getFilteredRowModel().rows.length} results
									</div>
								</div>
								<div className="flex items-center space-x-4">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">Show</span>
										<PageSizeSelect pageSize={table.state.pagination.pageSize} options={finalPageSizeOptions} onPageSizeChange={handlePageSizeChange} />
										<span className="text-sm text-muted-foreground">per page</span>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<Button variant="outline" size="sm" onClick={handleFirstPage} disabled={!table.getCanPreviousPage()} aria-label="Go to first page">
										<ChevronsLeft className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!table.getCanPreviousPage()} aria-label="Go to previous page">
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
									<Button variant="outline" size="sm" onClick={handleNextPage} disabled={!table.getCanNextPage()} aria-label="Go to next page">
										<ChevronRight className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" onClick={handleLastPage} disabled={!table.getCanNextPage()} aria-label="Go to last page">
										<ChevronsRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
