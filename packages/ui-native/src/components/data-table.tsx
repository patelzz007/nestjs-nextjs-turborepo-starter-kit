// A complete records table on TanStack Table (rules/06: the table engine), the web kit's `DataTable` for a phone:
// search, select filters, sorting, pagination (client or server), row and bulk actions, export, column visibility
// and pinning, inline editing, reordering, cards in place of rows, virtualised rows, and loading, empty and error
// states — each switched on by a prop.
//
// Columns are the native kit's own small shape (`DataTableColumn`: an id, a header, the value the table sorts,
// searches, filters and exports, and an optional cell drawing), turned into TanStack columns inside, so the
// component keeps its row type through `React.memo`. What the web and native tables share (copy, preferences,
// column ids, selection config, export documents) lives in @workspace/ui-kit-logic.
//
// On a phone the table scrolls sideways; pinned columns stay put at its start. With `renderCard` each row is a
// card instead (`DataTableCard` draws the usual one). Every control is a native one: filters, the columns menu,
// export and the page size open the kit's menus; row actions sit behind a ⋯ button; a sortable header is a button
// that says how it is sorted; selection is the kit's Checkbox; a reorder handle has move actions.

import {
	filterFn_equalsStringSensitive,
	columnFilteringFeature,
	columnPinningFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	tableFeatures,
	useTable,
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	type PaginationState,
	type Row,
	type RowData,
	type RowSelectionState,
	type SortingState,
	type Updater,
} from "@tanstack/react-table";
import {
	DATA_TABLE_UTILITY_COLUMN_IDS,
	DataTableCellScalarSchema,
	formatDataTableLabel,
	parseDataTablePersistedPrefs,
	reconcileDataTablePrefs,
	resolveDataTableCheckboxConfig,
	resolveDataTableRowActionTone,
	isServerPagination,
	type DataTableBulkSelectionContext,
	type DataTableCellScalar,
	type DataTableCheckboxConfig,
	type DataTableColumnPinning,
	type DataTableColumnVisibility,
	type DataTableExportFormat,
	type DataTablePagination,
	type DataTablePersistedPrefsPatch,
	type DataTableRowActionTone,
	type DataTableSorting,
	type DataTableStorageAdapter,
} from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import ArrowUpDownIcon from "lucide-react-native/icons/arrow-up-down";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import Columns3Icon from "lucide-react-native/icons/columns-3";
import DownloadIcon from "lucide-react-native/icons/download";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import InboxIcon from "lucide-react-native/icons/inbox";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import SearchIcon from "lucide-react-native/icons/search";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { FlatList, type ListRenderItemInfo, Pressable, ScrollView, Share, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import {
	DEFAULT_DATA_TABLE_LABELS,
	dataTableExportFileOf,
	dataTablePageRangeOf,
	nextDataTableSort,
	parseEditedDataTableCell,
	type DataTableExportFile,
	type DataTableExporter,
	type DataTableSortCycle,
	type NativeDataTableLabels,
} from "../lib/data-table";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { EmptyState, ErrorState } from "./empty";
import { Icon, type LucideIcon } from "./icon";
import { Input } from "./input";
import { Pagination } from "./pagination";
import { Skeleton, SkeletonGroup } from "./skeleton";
import { Sortable, SortableItem, SortableItemHandle, type SortableMove } from "./sortable";

// ── The engine ────────────────────────────────────────────────────────────

/** The TanStack features every native table uses, built once. */
export const dataTableFeatures = tableFeatures({
	columnFilteringFeature,
	columnPinningFeature,
	columnVisibilityFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
});

type DataTableFeatures = typeof dataTableFeatures;

/** A row reader, checked bivariantly so a `DataTable<Invoice>` keeps its row type through `memo` (see value-handler). */
type RowReader<TData, TResult> = { bivarianceHack(row: TData): TResult }["bivarianceHack"];
type RowHandler<TData> = { bivarianceHack(row: TData): void }["bivarianceHack"];
type CellEditHandler<TData> = { bivarianceHack(rowIndex: number, columnId: string, value: DataTableCellScalar, row: TData): void }["bivarianceHack"];
type RowReorderHandler<TData> = { bivarianceHack(fromIndex: number, toIndex: number, rows: TData[]): void }["bivarianceHack"];
type CardRenderer<TData> = { bivarianceHack(row: TData, actions: readonly DataTableBoundAction[]): React.ReactNode }["bivarianceHack"];

/** How wide a column is when the table scrolls sideways. */
export type DataTableColumnWidth = "xs" | "sm" | "md" | "lg";

/** One column: what it is called, the value it holds, and how its cell looks. */
export interface DataTableColumn<TData> {
	/** The column's id: what filters, search keys, editing, pinning and export name. */
	readonly id: string;
	readonly header: string;
	/** The cell's value: what the table sorts, searches, filters, edits and exports. */
	readonly value: RowReader<TData, DataTableCellScalar>;
	/** Draws the cell (a badge, an avatar and a name). Default: the value as text. */
	readonly cell?: RowReader<TData, React.ReactNode> | undefined;
	/** Default `md`. */
	readonly width?: DataTableColumnWidth | undefined;
	/** `end` for numbers. */
	readonly align?: "start" | "end" | undefined;
	/** Whether a header press sorts by it. Default `true`. */
	readonly enableSorting?: boolean | undefined;
	/** Whether the columns menu can hide it. Default `true`. */
	readonly enableHiding?: boolean | undefined;
	/** Whether the columns menu can pin it. Default `true`. */
	readonly enablePinning?: boolean | undefined;
}

/** A select filter on one column: its choices, each an exact value. */
export interface DataTableFilter {
	/** The column it filters (a server parameter's name in server mode). */
	readonly key: string;
	readonly label: string;
	readonly options: readonly { readonly value: string; readonly label: string }[];
}

/** A row action, in the row's ⋯ menu (an icon tile, a title and a subtitle) and on its card. */
export interface DataTableAction<TData> {
	readonly key: string;
	/** The title: what the action is ("Duplicate"). */
	readonly label: string;
	/** The subtitle under the title: what it does ("Copy this section as a draft"). Every entry has one. */
	readonly description: string;
	readonly icon?: LucideIcon | undefined;
	readonly onPress: RowHandler<TData>;
	/**
	 * The icon tile's colour: a hue of the tone palette, or `destructive` for an action that removes or cannot be
	 * undone. Left out, each entry takes the next hue in menu order (blue, violet, teal, green, orange).
	 */
	readonly tone?: DataTableRowActionTone | undefined;
}

/** A row action bound to its row, as a card draws it. */
export interface DataTableBoundAction {
	readonly key: string;
	readonly label: string;
	readonly icon?: LucideIcon | undefined;
	readonly destructive: boolean;
	readonly onPress: () => void;
}

/** What the table shows with no rows. */
export interface DataTableEmptyState {
	readonly icon?: LucideIcon | undefined;
	readonly title?: string | undefined;
	readonly description?: string | undefined;
	readonly action?: { readonly label: string; readonly onPress: () => void } | undefined;
}

export interface DataTableProps<TData extends RowData> {
	/** The rows. In server mode, only the current page. */
	readonly data: readonly TData[];
	/** The columns, in order. Keep the array stable (a module constant or a memo). */
	readonly columns: readonly DataTableColumn<TData>[];
	/** Select filters above the rows, each on one column `key`. */
	readonly filters?: readonly DataTableFilter[] | undefined;
	/** Row actions: a ⋯ menu at each row's end, buttons on its card. */
	readonly actions?: readonly DataTableAction<TData>[] | undefined;
	/** The columns the search matches. No search field without it. */
	readonly searchKeys?: readonly string[] | undefined;
	/** Rows per page to start with. Default 10. */
	readonly pageSize?: number | undefined;
	/** The page sizes people can pick. */
	readonly pageSizeOptions?: readonly number[] | undefined;
	/** `{ mode: "client" }` (the default) or `{ mode: "server", … }` when the parent fetches each page. */
	readonly pagination?: DataTablePagination<TData> | undefined;
	readonly title?: string | undefined;
	readonly description?: string | undefined;
	/** Draws each row as a card instead of a table row (the web's `mobileCardRender`). */
	readonly renderCard?: CardRenderer<TData> | undefined;
	/** Row checkboxes: `true`, or a config with bulk actions, a bulk delete and export. */
	readonly checkbox?: boolean | DataTableCheckboxConfig<TData, LucideIcon> | undefined;
	/** Hands an export on. Default: the system share sheet, with the file's text. */
	readonly exporter?: DataTableExporter | undefined;
	readonly emptyState?: DataTableEmptyState | undefined;
	/** Makes each row a button. */
	readonly onRowPress?: RowHandler<TData> | undefined;
	/** A columns menu to hide and show columns. */
	readonly enableColumnVisibility?: boolean | undefined;
	/** Lets the columns menu pin columns to the start, where they stay while the rest scroll. */
	readonly enableColumnPinning?: boolean | undefined;
	/** Remembers hidden and pinned columns, the page size and the sort under this key, in `storage`. */
	readonly persistKey?: string | undefined;
	readonly storage?: DataTableStorageAdapter | undefined;
	/** Whether the selection spans every matching row, not just the page, controlled. */
	readonly selectAllPages?: boolean | undefined;
	readonly onSelectAllPagesChange?: ((selectAllPages: boolean) => void) | undefined;
	/** The sort, controlled (server mode: the parent's). */
	readonly sorting?: DataTableSorting | undefined;
	/** Server mode: a header press asks the parent to sort. */
	readonly onManualSortingChange?: ((sorting: DataTableSorting) => void) | undefined;
	/** Server mode: the filters' values, controlled. */
	readonly manualColumnFilters?: Readonly<Record<string, string>> | undefined;
	readonly onManualColumnFilterChange?: ((filterKey: string, value: string | null) => void) | undefined;
	/** Cells edit in place: a press opens the value, done saves it. */
	readonly editable?: boolean | undefined;
	/** The columns that edit, by id. All of them when absent. */
	readonly editableColumns?: readonly string[] | undefined;
	/** An edit, with the row it belongs to: write it back by the row's id. */
	readonly onCellEdit?: CellEditHandler<TData> | undefined;
	/**
	 * Rows get a reorder handle: drag it, or use its move actions. The handle leads the scrolling part of each row (the
	 * part that moves), after any pinned columns; a virtualised body (`virtualizeRows`) draws none.
	 */
	readonly draggable?: boolean | undefined;
	/** A move, from and to positions among the rows shown, with those rows: reorder by id. */
	readonly onRowReorder?: RowReorderHandler<TData> | undefined;
	/** How long typing settles before the search filters. */
	readonly searchDebounceMs?: number | undefined;
	/** Draws only the rows in view, in a body `maxHeight` tall: for long local datasets. */
	readonly virtualizeRows?: boolean | undefined;
	readonly maxHeight?: number | undefined;
	/** The first load: skeleton rows in place of the table. */
	readonly isLoading?: boolean | undefined;
	/** A refetch: the rows stay, dimmed and announced busy. */
	readonly isRefetching?: boolean | undefined;
	readonly skeletonRows?: number | undefined;
	/** A message in place of the rows. */
	readonly error?: string | null | undefined;
	/** Offers a retry with the error. */
	readonly onRetry?: (() => void) | undefined;
	/** `asc-desc` (default), or `asc-desc-none` to return to the original order on the third press. */
	readonly sortCycle?: DataTableSortCycle | undefined;
	/** Anything more in the toolbar, after the menus. */
	readonly toolbarContent?: React.ReactNode | undefined;
	readonly labels?: Partial<NativeDataTableLabels> | undefined;
	/** Extra classes for the root, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

// ── Styles ────────────────────────────────────────────────────────────────

export const dataTableVariants = cva("w-full gap-3");

export const dataTableRowVariants = cva("h-12 flex-row items-center border-b border-border", {
	variants: {
		selected: { true: "bg-surface-selected", false: "" },
		pressable: { true: "active:bg-surface-selected", false: "" },
	},
	defaultVariants: { selected: false, pressable: false },
});

export const dataTableHeaderRowVariants = cva("h-10 flex-row items-center border-b border-border bg-muted/50");

/**
 * A data cell: its `width` is where it starts, and `grow` shares any room the screen has left evenly among the data
 * cells, so the table always spans its width (the utility cells keep theirs).
 */
export const dataTableCellVariants = cva("h-full grow justify-center px-3", {
	variants: {
		width: { xs: "w-16", sm: "w-24", md: "w-36", lg: "w-52" },
		align: { start: "items-start", end: "items-end" },
	},
	defaultVariants: { width: "md", align: "start" },
});

/** The table's own narrow columns: the handle, the checkbox, the ⋯ menu. */
export const dataTableUtilityCellVariants = cva("h-full w-12 items-center justify-center");

export const dataTableBodyVariants = cva("", {
	variants: { refetching: { true: "opacity-60", false: "" } },
	defaultVariants: { refetching: false },
});

/** The row height virtualisation lays rows out by (the `h-12` above). */
const ROW_HEIGHT = 48;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 50, 100];
const DEFAULT_SKELETON_ROWS = 5;
/** The value an "all" filter choice carries in the menus. */
const FILTER_ALL = "__all__";
/** The column a select filter stores through: an exact value match (TanStack's "auto" would match substrings). */
const SELECT_FILTER_FN = filterFn_equalsStringSensitive;
/** Formats the native share sheet can hand on as text. A PDF needs a print module the app supplies. */
const SHAREABLE_FORMATS: readonly DataTableExportFormat[] = ["csv", "json", "xlsx"];
const NO_FILTERS: readonly DataTableFilter[] = [];
const NO_ACTIONS: readonly DataTableAction<RowData>[] = [];
const NO_SEARCH_KEYS: readonly string[] = [];
const NO_PINNING: DataTableColumnPinning = { start: [], end: [] };

/** The default exporter: the system share sheet, carrying the file's text. */
async function shareExport(file: DataTableExportFile): Promise<void> {
	await Share.share({ title: file.filename, message: file.text });
}

function applyUpdater<T>(updater: Updater<T>, previous: T): T {
	return updater instanceof Function ? updater(previous) : updater;
}

function scalarText(value: DataTableCellScalar): string {
	return value === null ? "" : String(value);
}

/** A row's name for its controls: the first column's value. */
function rowNameOf(row: Row<DataTableFeatures, RowData>, firstColumnId: string | undefined): string {
	if (firstColumnId === undefined) {
		return row.id;
	}
	const parsed = DataTableCellScalarSchema.safeParse(row.getValue(firstColumnId));
	return parsed.success ? scalarText(parsed.data) : row.id;
}

function cellValueOf(row: Row<DataTableFeatures, RowData>, columnId: string): DataTableCellScalar {
	const parsed = DataTableCellScalarSchema.safeParse(row.getValue(columnId));
	return parsed.success ? parsed.data : null;
}

// ── Toolbar ───────────────────────────────────────────────────────────────

interface FilterMenuProps {
	readonly filter: DataTableFilter;
	readonly value: string | null;
	readonly onChange: (key: string, value: string | null) => void;
	readonly labels: NativeDataTableLabels;
}

function FilterMenu({ filter, value, onChange, labels }: FilterMenuProps): React.JSX.Element {
	const items = React.useMemo(
		(): DropdownMenuItemData<string>[] => [
			{ value: FILTER_ALL, label: labels.filterAll, kind: "radio", checked: value === null },
			...filter.options.map((option): DropdownMenuItemData<string> => ({ value: option.value, label: option.label, kind: "radio", checked: value === option.value })),
		],
		[filter.options, labels.filterAll, value],
	);
	const chosen = filter.options.find((option): boolean => option.value === value)?.label ?? labels.filterAll;
	const handleSelect = React.useCallback(
		(next: string): void => {
			onChange(filter.key, next === FILTER_ALL ? null : next);
		},
		[filter.key, onChange],
	);
	return <DropdownMenu label={`${filter.label}: ${chosen}`} title={filter.label} items={items} onSelect={handleSelect} size="sm" />;
}

interface ColumnsMenuProps {
	readonly columns: readonly Column<DataTableFeatures, RowData>[];
	readonly headers: Readonly<Record<string, string>>;
	readonly pinning: boolean;
	readonly labels: NativeDataTableLabels;
}

/** Column ids in the menu: visibility rows as `<id>`, pin rows as `pin:<id>`. */
const PIN_PREFIX = "pin:";

function ColumnsMenu({ columns, headers, pinning, labels }: ColumnsMenuProps): React.JSX.Element {
	const items = React.useMemo((): DropdownMenuItemData<string>[] => {
		const visibility = columns
			.filter((column): boolean => column.getCanHide())
			.map((column): DropdownMenuItemData<string> => ({
				value: column.id,
				label: headers[column.id] ?? column.id,
				kind: "checkbox",
				checked: column.getIsVisible(),
				group: labels.columnsToggle,
			}));
		const pins = pinning
			? columns
					.filter((column): boolean => column.getCanPin())
					.map((column): DropdownMenuItemData<string> => ({
						value: `${PIN_PREFIX}${column.id}`,
						label: formatDataTableLabel(labels.pinNamedColumn, { column: headers[column.id] ?? column.id }),
						kind: "checkbox",
						checked: column.getIsPinned() === "start",
						group: labels.pinColumnAriaLabel,
					}))
			: [];
		return [...visibility, ...pins];
	}, [columns, headers, labels.columnsToggle, labels.pinColumnAriaLabel, labels.pinNamedColumn, pinning]);
	const handleSelect = React.useCallback(
		(value: string): void => {
			const pinId = value.startsWith(PIN_PREFIX) ? value.slice(PIN_PREFIX.length) : null;
			const column = columns.find((candidate): boolean => candidate.id === (pinId ?? value));
			if (column === undefined) {
				return;
			}
			if (pinId === null) {
				column.toggleVisibility();
			} else {
				column.pin(column.getIsPinned() === "start" ? false : "start");
			}
		},
		[columns],
	);
	return <DropdownMenu label={labels.columnsToggle} items={items} onSelect={handleSelect} icon={Columns3Icon} size="sm" />;
}

interface ExportMenuProps {
	readonly formats: readonly DataTableExportFormat[];
	readonly onExport: (format: DataTableExportFormat) => void;
	readonly labels: NativeDataTableLabels;
}

function ExportMenu({ formats, onExport, labels }: ExportMenuProps): React.JSX.Element {
	const items = React.useMemo((): DropdownMenuItemData<DataTableExportFormat>[] => {
		const text: Readonly<Record<DataTableExportFormat, { readonly label: string; readonly description: string }>> = {
			csv: { label: labels.exportCsv, description: labels.exportCsvDescription },
			json: { label: labels.exportJson, description: labels.exportJsonDescription },
			xlsx: { label: labels.exportSpreadsheet, description: labels.exportSpreadsheetDescription },
			pdf: { label: labels.exportPdf, description: labels.exportPdfDescription },
		};
		return formats.map((format): DropdownMenuItemData<DataTableExportFormat> => ({ value: format, ...text[format] }));
	}, [formats, labels]);
	return <DropdownMenu label={labels.export} title={labels.exportAs} items={items} onSelect={onExport} icon={DownloadIcon} size="sm" />;
}

// ── Rows ──────────────────────────────────────────────────────────────────

interface HeaderCellProps {
	readonly column: Column<DataTableFeatures, RowData>;
	readonly header: string;
	readonly width: DataTableColumnWidth;
	readonly align: "start" | "end";
	readonly sortCycle: DataTableSortCycle;
	readonly labels: NativeDataTableLabels;
}

function HeaderCell({ column, header, width, align, sortCycle, labels }: HeaderCellProps): React.JSX.Element {
	const sorted = column.getIsSorted();
	const canSort = column.getCanSort();
	const handlePress = React.useCallback((): void => {
		const next = nextDataTableSort(column.getIsSorted(), sortCycle);
		if (next === false) {
			column.clearSorting();
		} else {
			column.toggleSorting(next === "desc");
		}
	}, [column, sortCycle]);
	const title = (
		<Text numberOfLines={1} className="text-caption font-sans-medium text-muted-foreground">
			{header}
		</Text>
	);
	if (!canSort) {
		return (
			<View accessible accessibilityRole="header" accessibilityLabel={header} className={dataTableCellVariants({ width, align })}>
				{title}
			</View>
		);
	}
	const sortIcon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
	const state = sorted === "asc" ? labels.sortedAscending : sorted === "desc" ? labels.sortedDescending : null;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={state === null ? header : `${header}, ${state}`}
			accessibilityHint={labels.sortHint}
			onPress={handlePress}
			className={cn(dataTableCellVariants({ width, align }), "flex-row items-center justify-start gap-1 active:opacity-70")}>
			{title}
			<Icon icon={sortIcon} size="xs" colorClassName={sorted === false ? "accent-muted-foreground" : "accent-primary"} />
		</Pressable>
	);
}

interface EditableCellProps {
	readonly row: Row<DataTableFeatures, RowData>;
	readonly columnId: string;
	readonly header: string;
	readonly children: React.ReactNode;
	readonly onCommit: (row: Row<DataTableFeatures, RowData>, columnId: string, text: string) => void;
	readonly labels: NativeDataTableLabels;
}

function EditableCell({ row, columnId, header, children, onCommit, labels }: EditableCellProps): React.JSX.Element {
	const [draft, setDraft] = React.useState<string | null>(null);
	const open = React.useCallback((): void => {
		setDraft(scalarText(cellValueOf(row, columnId)));
	}, [columnId, row]);
	const commit = React.useCallback((): void => {
		if (draft !== null) {
			onCommit(row, columnId, draft);
		}
		setDraft(null);
	}, [columnId, draft, onCommit, row]);
	if (draft !== null) {
		return (
			<Input
				value={draft}
				onChange={setDraft}
				onSubmitEditing={commit}
				onBlur={commit}
				autoFocus
				selectTextOnFocus
				accessibilityLabel={header}
				size="sm"
				returnKeyType="done"
				className="min-h-9 w-full"
			/>
		);
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={scalarText(cellValueOf(row, columnId))}
			accessibilityHint={formatDataTableLabel(labels.editCell, { column: header })}
			onPress={open}
			className="w-full active:opacity-70">
			{children}
		</Pressable>
	);
}

interface RowActionsProps {
	readonly row: Row<DataTableFeatures, RowData>;
	readonly actions: readonly DataTableAction<RowData>[];
	readonly rowName: string;
	readonly labels: NativeDataTableLabels;
}

/** Each tone's icon tile: the hue as the glyph's colour on its own soft fill. */
const ROW_ACTION_TONE_TILE: Readonly<Record<DataTableRowActionTone, { readonly fill: string; readonly glyph: string }>> = {
	blue: { fill: "bg-tone-blue-soft", glyph: "accent-tone-blue" },
	violet: { fill: "bg-tone-violet-soft", glyph: "accent-tone-violet" },
	teal: { fill: "bg-tone-teal-soft", glyph: "accent-tone-teal" },
	green: { fill: "bg-tone-green-soft", glyph: "accent-tone-green" },
	orange: { fill: "bg-tone-orange-soft", glyph: "accent-tone-orange" },
	yellow: { fill: "bg-tone-yellow-soft", glyph: "accent-tone-yellow" },
	destructive: { fill: "bg-destructive-soft", glyph: "accent-destructive" },
};

/** A row action's coloured icon tile, in front of its title in the ⋯ menu; decorative (the title names the action). */
function RowActionTile({ icon, tone }: { readonly icon: LucideIcon; readonly tone: DataTableRowActionTone }): React.JSX.Element {
	const { fill, glyph } = ROW_ACTION_TONE_TILE[tone];
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			className={cn("size-8 items-center justify-center rounded-full", fill)}
			testID={`row-action-tile-${tone}`}>
			<Icon icon={icon} size="sm" colorClassName={glyph} />
		</View>
	);
}

function RowActions({ row, actions, rowName, labels }: RowActionsProps): React.JSX.Element {
	const items = React.useMemo(
		(): DropdownMenuItemData<string>[] =>
			actions.map((action, position): DropdownMenuItemData<string> => {
				const tone = resolveDataTableRowActionTone(action.tone, position);
				return {
					value: action.key,
					label: action.label,
					description: action.description,
					leading: action.icon === undefined ? undefined : <RowActionTile icon={action.icon} tone={tone} />,
					variant: tone === "destructive" ? "destructive" : "default",
				};
			}),
		[actions],
	);
	const handleSelect = React.useCallback(
		(key: string): void => {
			actions.find((action): boolean => action.key === key)?.onPress(row.original);
		},
		[actions, row],
	);
	return (
		<DropdownMenu
			label={`${labels.openRowMenu}, ${rowName}`}
			title={labels.actionsMenuTitle}
			items={items}
			onSelect={handleSelect}
			icon={EllipsisIcon}
			variant="ghost"
			size="icon"
			hideChevron
		/>
	);
}

interface BodyRowProps {
	readonly row: Row<DataTableFeatures, RowData>;
	readonly columns: readonly Column<DataTableFeatures, RowData>[];
	readonly definitions: ReadonlyMap<string, DataTableColumn<RowData>>;
	readonly selectable: boolean;
	readonly selected: boolean;
	readonly onToggleSelected: (row: Row<DataTableFeatures, RowData>, selected: boolean) => void;
	readonly actions: readonly DataTableAction<RowData>[];
	readonly rowName: string;
	readonly editableColumns: ReadonlySet<string> | null;
	readonly onCellCommit: (row: Row<DataTableFeatures, RowData>, columnId: string, text: string) => void;
	readonly onRowPress: RowHandler<RowData> | undefined;
	/** Draws the row's drag handle: only in the part of the row that sits in the `Sortable`. */
	readonly dragHandle: boolean;
	readonly showUtilities: boolean;
	readonly labels: NativeDataTableLabels;
}

/** One row's cells (the pinned part or the scrolling part, `showUtilities` saying which holds the selection box). */
const BodyRow = React.memo(function BodyRow({
	row,
	columns,
	definitions,
	selectable,
	selected,
	onToggleSelected,
	actions,
	rowName,
	editableColumns,
	onCellCommit,
	onRowPress,
	dragHandle,
	showUtilities,
	labels,
}: BodyRowProps): React.JSX.Element {
	const handleSelected = React.useCallback(
		(checked: boolean): void => {
			onToggleSelected(row, checked);
		},
		[onToggleSelected, row],
	);
	const handlePress = React.useCallback((): void => {
		onRowPress?.(row.original);
	}, [onRowPress, row]);
	const cells = (
		<>
			{dragHandle ? (
				<View className={dataTableUtilityCellVariants()}>
					<SortableItemHandle>
						<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
					</SortableItemHandle>
				</View>
			) : null}
			{showUtilities && selectable ? (
				<View className={dataTableUtilityCellVariants()}>
					<Checkbox label={formatDataTableLabel(labels.selectNamedRow, { row: rowName })} labelHidden checked={selected} onChange={handleSelected} size="sm" />
				</View>
			) : null}
			{columns.map((column): React.JSX.Element => {
				const definition = definitions.get(column.id);
				const drawn = definition?.cell?.(row.original) ?? (
					<Text numberOfLines={1} className="text-label font-sans text-foreground">
						{scalarText(cellValueOf(row, column.id))}
					</Text>
				);
				const editable = editableColumns?.has(column.id) ?? false;
				return (
					<View key={column.id} className={dataTableCellVariants({ width: definition?.width ?? "md", align: definition?.align ?? "start" })}>
						{editable ? (
							<EditableCell row={row} columnId={column.id} header={definition?.header ?? column.id} onCommit={onCellCommit} labels={labels}>
								{drawn}
							</EditableCell>
						) : (
							drawn
						)}
					</View>
				);
			})}
			{!showUtilities || actions.length === 0 ? null : (
				<View className={dataTableUtilityCellVariants()}>
					<RowActions row={row} actions={actions} rowName={rowName} labels={labels} />
				</View>
			)}
		</>
	);
	if (onRowPress !== undefined && showUtilities) {
		return (
			<Pressable accessibilityRole="button" accessibilityLabel={rowName} onPress={handlePress} className={dataTableRowVariants({ selected, pressable: true })}>
				{cells}
			</Pressable>
		);
	}
	return <View className={dataTableRowVariants({ selected })}>{cells}</View>;
});

// ── The table ─────────────────────────────────────────────────────────────

type DataTableComponent = <TData extends RowData>(props: DataTableProps<TData> & React.RefAttributes<ViewInstance>) => React.ReactNode;

const DataTableBase = React.forwardRef<ViewInstance, DataTableProps<RowData>>(function DataTable(
	{
		data,
		columns: columnDefinitions,
		filters = NO_FILTERS,
		actions = NO_ACTIONS,
		searchKeys = NO_SEARCH_KEYS,
		pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
		pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
		pagination: paginationProp,
		title,
		description,
		renderCard,
		checkbox,
		exporter = shareExport,
		emptyState,
		onRowPress,
		enableColumnVisibility = false,
		enableColumnPinning = false,
		persistKey,
		storage,
		selectAllPages: selectAllPagesProp,
		onSelectAllPagesChange,
		sorting: controlledSorting,
		onManualSortingChange,
		manualColumnFilters,
		onManualColumnFilterChange,
		editable = false,
		editableColumns,
		onCellEdit,
		draggable = false,
		onRowReorder,
		searchDebounceMs = 0,
		virtualizeRows = false,
		maxHeight,
		isLoading = false,
		isRefetching = false,
		skeletonRows = DEFAULT_SKELETON_ROWS,
		error,
		onRetry,
		sortCycle = "asc-desc",
		toolbarContent,
		labels: labelsOverride,
		className,
		testID,
	},
	ref,
): React.JSX.Element {
	const labels = React.useMemo((): NativeDataTableLabels => ({ ...DEFAULT_DATA_TABLE_LABELS, ...labelsOverride }), [labelsOverride]);
	const serverPagination = isServerPagination(paginationProp) ? paginationProp : undefined;
	const isServerMode = serverPagination !== undefined;
	const getRowIdOption = paginationProp?.getRowId;

	// Preferences: read once, checked against the live columns.
	const columnIds = React.useMemo((): string[] => columnDefinitions.map((column): string => column.id), [columnDefinitions]);
	const [initialPrefs] = React.useState(() => {
		const saved = persistKey === undefined || storage === undefined ? null : storage.read(persistKey);
		const prefs = saved === null ? null : parseDataTablePersistedPrefs(JSON.stringify(saved));
		return reconcileDataTablePrefs({ prefs, columnIds, pageSizeOptions, defaultPageSize: initialPageSize, isServerMode });
	});
	const persist = React.useCallback(
		(patch: DataTablePersistedPrefsPatch): void => {
			if (persistKey !== undefined && storage !== undefined) {
				storage.write(persistKey, patch);
			}
		},
		[persistKey, storage],
	);

	const [sorting, setSorting] = React.useState<SortingState>(initialPrefs.sorting);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
	const [searchText, setSearchText] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: initialPrefs.pageSize });
	const [columnVisibility, setColumnVisibility] = React.useState<DataTableColumnVisibility>(initialPrefs.columnVisibility);
	const [columnPinning, setColumnPinning] = React.useState<DataTableColumnPinning>(enableColumnPinning ? initialPrefs.columnPinning : NO_PINNING);
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const [ownSelectAllPages, setOwnSelectAllPages] = React.useState(false);
	const selectAllPages = selectAllPagesProp ?? ownSelectAllPages;
	const setSelectAllPages = React.useCallback(
		(next: boolean): void => {
			setOwnSelectAllPages(next);
			onSelectAllPagesChange?.(next);
		},
		[onSelectAllPagesChange],
	);

	// The search settles for `searchDebounceMs` before it filters (at once without a debounce).
	const [settledSearch, setSettledSearch] = React.useState("");
	React.useEffect((): (() => void) => {
		if (searchDebounceMs <= 0) {
			return (): void => undefined;
		}
		const timer = setTimeout((): void => {
			setSettledSearch(searchText);
		}, searchDebounceMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [searchDebounceMs, searchText]);
	const globalFilter = searchDebounceMs <= 0 ? searchText : settledSearch;

	const definitions = React.useMemo(
		(): ReadonlyMap<string, DataTableColumn<RowData>> => new Map(columnDefinitions.map((column): [string, DataTableColumn<RowData>] => [column.id, column])),
		[columnDefinitions],
	);
	const headers = React.useMemo(
		(): Readonly<Record<string, string>> => Object.fromEntries(columnDefinitions.map((column): [string, string] => [column.id, column.header])),
		[columnDefinitions],
	);
	const tableColumns = React.useMemo(
		(): ColumnDef<DataTableFeatures, RowData>[] =>
			columnDefinitions.map((column): ColumnDef<DataTableFeatures, RowData> => ({
				id: column.id,
				header: column.header,
				accessorFn: column.value,
				filterFn: SELECT_FILTER_FN,
				enableSorting: column.enableSorting ?? true,
				enableHiding: column.enableHiding ?? true,
				enablePinning: column.enablePinning ?? true,
			})),
		[columnDefinitions],
	);
	const rows = React.useMemo((): RowData[] => [...data], [data]);
	const getRowId = React.useCallback((row: RowData, index: number): string => (getRowIdOption === undefined ? String(index) : getRowIdOption(row)), [getRowIdOption]);

	const handleSortingChange = React.useCallback(
		(updater: Updater<SortingState>): void => {
			const next = applyUpdater(updater, controlledSorting ?? sorting);
			setSorting(next);
			setPagination((current): PaginationState => ({ ...current, pageIndex: 0 }));
			if (isServerMode) {
				onManualSortingChange?.(next);
			} else {
				persist({ sorting: next });
			}
		},
		[controlledSorting, isServerMode, onManualSortingChange, persist, sorting],
	);
	const handleVisibilityChange = React.useCallback(
		(updater: Updater<DataTableColumnVisibility>): void => {
			setColumnVisibility((current): DataTableColumnVisibility => {
				const next = applyUpdater(updater, current);
				persist({ columnVisibility: next });
				return next;
			});
		},
		[persist],
	);
	const handlePinningChange = React.useCallback(
		(updater: Updater<DataTableColumnPinning>): void => {
			setColumnPinning((current): DataTableColumnPinning => {
				const next = applyUpdater(updater, current);
				persist({ columnPinning: next });
				return next;
			});
		},
		[persist],
	);
	const searchColumns = React.useMemo((): ReadonlySet<string> => new Set(searchKeys), [searchKeys]);
	const globalFilterFn = React.useCallback(
		(row: Row<DataTableFeatures, RowData>, _columnId: string, filterValue: string): boolean => {
			const needle = filterValue.toLowerCase();
			return [...searchColumns].some((key): boolean => scalarText(cellValueOf(row, key)).toLowerCase().includes(needle));
		},
		[searchColumns],
	);

	const resolvedCheckbox = React.useMemo(() => resolveDataTableCheckboxConfig<RowData, LucideIcon>({ checkbox, labels, deleteSelectedIcon: Trash2Icon }), [checkbox, labels]);
	const selectable = resolvedCheckbox.enableBulkSelection;

	const table = useTable({
		features: dataTableFeatures,
		data: rows,
		columns: tableColumns,
		getRowId,
		state: {
			sorting: controlledSorting ?? sorting,
			columnFilters,
			globalFilter,
			pagination: isServerMode ? { pageIndex: 0, pageSize: serverPagination.pageSize } : pagination,
			columnVisibility,
			columnPinning,
			rowSelection,
		},
		onSortingChange: handleSortingChange,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		onColumnVisibilityChange: handleVisibilityChange,
		onColumnPinningChange: handlePinningChange,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: selectable,
		enableColumnPinning,
		manualPagination: isServerMode,
		manualSorting: isServerMode,
		manualFiltering: isServerMode,
		...(isServerMode ? { pageCount: Math.max(1, Math.ceil(serverPagination.totalCount / serverPagination.pageSize)) } : {}),
		globalFilterFn,
	});

	// Filters: TanStack's in client mode, the parent's in server mode.
	const filterValueOf = React.useCallback(
		(key: string): string | null => {
			if (isServerMode) {
				const value = manualColumnFilters?.[key];
				return value === undefined || value === "all" ? null : value;
			}
			const found = columnFilters.find((entry): boolean => entry.id === key);
			const parsed = DataTableCellScalarSchema.safeParse(found?.value);
			return parsed.success && parsed.data !== null ? String(parsed.data) : null;
		},
		[columnFilters, isServerMode, manualColumnFilters],
	);
	const handleFilterChange = React.useCallback(
		(key: string, value: string | null): void => {
			if (isServerMode) {
				onManualColumnFilterChange?.(key, value);
				return;
			}
			table.getColumn(key)?.setFilterValue(value ?? undefined);
			setPagination((current): PaginationState => ({ ...current, pageIndex: 0 }));
		},
		[isServerMode, onManualColumnFilterChange, table],
	);
	const isFiltered = globalFilter !== "" || (isServerMode ? (serverPagination.isFiltered ?? false) : columnFilters.length > 0);
	const clearFilters = React.useCallback((): void => {
		setSearchText("");
		setSettledSearch("");
		if (isServerMode) {
			serverPagination.onClearFilters?.();
			return;
		}
		setColumnFilters([]);
	}, [isServerMode, serverPagination]);

	// Rows, selection and paging.
	const pageRows = table.getRowModel().rows;
	const filteredRows = table.getFilteredRowModel().rows;
	const totalCount = isServerMode ? serverPagination.totalCount : filteredRows.length;
	const pageIndex = isServerMode ? serverPagination.pageIndex : pagination.pageIndex;
	const pageSize = isServerMode ? serverPagination.pageSize : pagination.pageSize;
	const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
	const selectedPageRows = pageRows.filter((row): boolean => rowSelection[row.id] === true);
	const selectedRows = selectAllPages ? filteredRows : table.getSelectedRowModel().flatRows;
	const selectedCount = selectAllPages ? totalCount : selectedRows.length;
	const allPageSelected = pageRows.length > 0 && selectedPageRows.length === pageRows.length;
	const somePageSelected = !allPageSelected && selectedPageRows.length > 0;
	const selectionContext = React.useMemo((): DataTableBulkSelectionContext => ({ selectAllPages, totalMatchingRows: totalCount }), [selectAllPages, totalCount]);

	const toggleRow = React.useCallback(
		(row: Row<DataTableFeatures, RowData>, selected: boolean): void => {
			row.toggleSelected(selected);
			if (!selected) {
				setSelectAllPages(false);
			}
		},
		[setSelectAllPages],
	);
	const togglePage = React.useCallback(
		(selected: boolean): void => {
			table.toggleAllPageRowsSelected(selected);
			if (!selected) {
				setSelectAllPages(false);
			}
		},
		[setSelectAllPages, table],
	);
	const clearSelection = React.useCallback((): void => {
		table.resetRowSelection();
		setSelectAllPages(false);
	}, [setSelectAllPages, table]);
	const selectEveryRow = React.useCallback((): void => {
		setSelectAllPages(true);
	}, [setSelectAllPages]);
	const runBulkAction = React.useCallback(
		(key: string): void => {
			const action = resolvedCheckbox.bulkActions.find((candidate): boolean => candidate.key === key);
			if (action === undefined) {
				return;
			}
			const result = action.onClick(
				selectedRows.map((row): RowData => row.original),
				selectionContext,
			);
			Promise.resolve(result)
				.then((): void => {
					clearSelection();
				})
				// The action reports its own failure; the selection stays so it can be retried.
				.catch((): void => undefined);
		},
		[clearSelection, resolvedCheckbox.bulkActions, selectedRows, selectionContext],
	);

	const exportFormats = React.useMemo(
		(): DataTableExportFormat[] => resolvedCheckbox.exportFormats.filter((format): boolean => SHAREABLE_FORMATS.includes(format)),
		[resolvedCheckbox.exportFormats],
	);
	const handleExport = React.useCallback(
		(format: DataTableExportFormat): void => {
			const source = selectedCount > 0 ? selectedRows : isServerMode ? pageRows : filteredRows;
			const ids = (resolvedCheckbox.exportableColumns ?? columnIds).filter((id): boolean => !DATA_TABLE_UTILITY_COLUMN_IDS.some((utility): boolean => utility === id));
			const records = source.map((row): Record<string, DataTableCellScalar> => Object.fromEntries(ids.map((id): [string, DataTableCellScalar] => [id, cellValueOf(row, id)])));
			const file = dataTableExportFileOf(format, records, ids, resolvedCheckbox.exportFilename ?? title ?? "export");
			// The exporter reports its own failure (a dismissed share sheet is not one).
			exporter(file).catch((): void => undefined);
		},
		[columnIds, exporter, filteredRows, isServerMode, pageRows, resolvedCheckbox.exportFilename, resolvedCheckbox.exportableColumns, selectedCount, selectedRows, title],
	);

	const handlePageChange = React.useCallback(
		(page: number): void => {
			if (isServerMode) {
				serverPagination.onPageChange(page - 1, serverPagination.pageSize);
				return;
			}
			setPagination((current): PaginationState => ({ ...current, pageIndex: page - 1 }));
		},
		[isServerMode, serverPagination],
	);
	const handlePageSize = React.useCallback(
		(value: string): void => {
			const next = Number(value);
			persist({ pageSize: next });
			if (isServerMode) {
				serverPagination.onPageChange(0, next);
				return;
			}
			setPagination({ pageIndex: 0, pageSize: next });
		},
		[isServerMode, persist, serverPagination],
	);
	const pageSizeItems = React.useMemo(
		(): DropdownMenuItemData<string>[] =>
			pageSizeOptions.map((option): DropdownMenuItemData<string> => ({
				value: String(option),
				label: formatDataTableLabel(labels.pageSizeOption, { count: option }),
				kind: "radio",
				checked: option === pageSize,
			})),
		[labels.pageSizeOption, pageSize, pageSizeOptions],
	);

	const editableSet = React.useMemo((): ReadonlySet<string> | null => (editable ? new Set(editableColumns ?? columnIds) : null), [columnIds, editable, editableColumns]);
	const handleCellCommit = React.useCallback(
		(row: Row<DataTableFeatures, RowData>, columnId: string, text: string): void => {
			const previous = cellValueOf(row, columnId);
			const next = parseEditedDataTableCell(previous, text);
			if (next !== previous) {
				onCellEdit?.(row.index, columnId, next, row.original);
			}
		},
		[onCellEdit],
	);

	const pageRowIds = React.useMemo((): string[] => pageRows.map((row): string => row.id), [pageRows]);
	const ignoreOrder = React.useCallback((): void => undefined, []);
	const identity = React.useCallback((id: string): string => id, []);
	const handleReorder = React.useCallback(
		(_order: readonly string[], move: SortableMove): void => {
			onRowReorder?.(
				move.activeIndex,
				move.overIndex,
				pageRows.map((row): RowData => row.original),
			);
		},
		[onRowReorder, pageRows],
	);

	// Columns: pinned ones first, in a block that does not scroll (virtualised rows keep one block).
	const pinsColumns = enableColumnPinning && !virtualizeRows;
	const { allColumns, pinnedColumns, scrollingColumns } = React.useMemo(() => {
		const all = table.getAllLeafColumns().filter((column): boolean => columnIds.includes(column.id));
		const visible = all.filter((column): boolean => columnVisibility[column.id] !== false);
		const pinnedIds = pinsColumns ? columnPinning.start : [];
		return {
			allColumns: all,
			pinnedColumns: visible.filter((column): boolean => pinnedIds.includes(column.id)),
			scrollingColumns: visible.filter((column): boolean => !pinnedIds.includes(column.id)),
		};
	}, [columnIds, columnPinning.start, columnVisibility, pinsColumns, table]);
	const firstColumnId = columnDefinitions.at(0)?.id;
	const hasPinnedBlock = pinnedColumns.length > 0;

	const bodyStyle = React.useMemo(() => (maxHeight === undefined ? undefined : { maxHeight }), [maxHeight]);
	const renderRowPart = React.useCallback(
		(row: Row<DataTableFeatures, RowData>, part: readonly Column<DataTableFeatures, RowData>[], showUtilities: boolean, dragHandle: boolean): React.JSX.Element => (
			<BodyRow
				row={row}
				columns={part}
				definitions={definitions}
				selectable={selectable}
				selected={selectAllPages || rowSelection[row.id] === true}
				onToggleSelected={toggleRow}
				actions={actions}
				rowName={rowNameOf(row, firstColumnId)}
				editableColumns={editableSet}
				onCellCommit={handleCellCommit}
				onRowPress={onRowPress}
				dragHandle={dragHandle}
				showUtilities={showUtilities}
				labels={labels}
			/>
		),
		[actions, definitions, editableSet, firstColumnId, handleCellCommit, labels, onRowPress, rowSelection, selectAllPages, selectable, toggleRow],
	);
	const renderVirtualRow = React.useCallback(
		({ item }: ListRenderItemInfo<Row<DataTableFeatures, RowData>>): React.JSX.Element => renderRowPart(item, scrollingColumns, true, false),
		[renderRowPart, scrollingColumns],
	);
	const rowKey = React.useCallback((row: Row<DataTableFeatures, RowData>): string => row.id, []);
	const rowLayout = React.useCallback(
		(_rows: ArrayLike<Row<DataTableFeatures, RowData>> | null | undefined, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }),
		[],
	);

	const headerRow = (part: readonly Column<DataTableFeatures, RowData>[], showUtilities: boolean, dragHandle: boolean): React.JSX.Element => (
		<View className={dataTableHeaderRowVariants()}>
			{dragHandle ? <View className={dataTableUtilityCellVariants()} /> : null}
			{showUtilities && selectable ? (
				<View className={dataTableUtilityCellVariants()}>
					<Checkbox label={labels.selectAllAriaLabel} labelHidden checked={allPageSelected} indeterminate={somePageSelected} onChange={togglePage} size="sm" />
				</View>
			) : null}
			{part.map((column): React.JSX.Element => (
				<HeaderCell
					key={column.id}
					column={column}
					header={headers[column.id] ?? column.id}
					width={definitions.get(column.id)?.width ?? "md"}
					align={definitions.get(column.id)?.align ?? "start"}
					sortCycle={sortCycle}
					labels={labels}
				/>
			))}
			{showUtilities && actions.length > 0 ? <View className={dataTableUtilityCellVariants()} /> : null}
		</View>
	);

	const boundActionsOf = (row: Row<DataTableFeatures, RowData>): readonly DataTableBoundAction[] =>
		actions.map((action): DataTableBoundAction => ({
			key: action.key,
			label: action.label,
			icon: action.icon,
			destructive: action.tone === "destructive",
			onPress: (): void => {
				action.onPress(row.original);
			},
		}));

	// ── Body: loading, error, empty, cards or the table ──
	let body: React.ReactNode;
	if (isLoading) {
		body = (
			<SkeletonGroup accessibilityLabel={labels.loadingTableAriaLabel} className="gap-2">
				{Array.from({ length: skeletonRows }, (_, index): React.JSX.Element => (
					<Skeleton key={String(index)} className="h-12 w-full rounded-lg" />
				))}
			</SkeletonGroup>
		);
	} else if (error !== undefined && error !== null) {
		body =
			onRetry === undefined ? (
				<EmptyState message={error} icon={CircleAlertIcon} iconTone="red" />
			) : (
				<ErrorState message={error} retryLabel={labels.retry} onRetry={onRetry} />
			);
	} else if (pageRows.length === 0) {
		body = isFiltered ? (
			<EmptyState title={labels.noResultsTitle} message={labels.noResultsDescription} icon={SearchIcon}>
				<Button label={labels.clearFilters} variant="outline" size="sm" onPress={clearFilters} />
			</EmptyState>
		) : (
			<EmptyState title={emptyState?.title ?? labels.noDataTitle} message={emptyState?.description ?? labels.noDataDescription} icon={emptyState?.icon ?? InboxIcon}>
				{emptyState?.action === undefined ? null : <Button label={emptyState.action.label} size="sm" onPress={emptyState.action.onPress} />}
			</EmptyState>
		);
	} else if (renderCard !== undefined) {
		body = (
			<View className={cn(dataTableBodyVariants({ refetching: isRefetching }), "gap-3")}>
				{pageRows.map((row): React.JSX.Element => (
					<CardRow
						key={row.id}
						row={row}
						selectable={selectable}
						selected={selectAllPages || rowSelection[row.id] === true}
						onToggleSelected={toggleRow}
						rowName={rowNameOf(row, firstColumnId)}
						labels={labels}>
						{renderCard(row.original, boundActionsOf(row))}
					</CardRow>
				))}
			</View>
		);
	} else if (virtualizeRows) {
		body = (
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="grow">
				<View className={cn(dataTableBodyVariants({ refetching: isRefetching }), "grow")}>
					{headerRow(scrollingColumns, true, false)}
					<FlatList data={pageRows} renderItem={renderVirtualRow} keyExtractor={rowKey} getItemLayout={rowLayout} style={bodyStyle} nestedScrollEnabled />
				</View>
			</ScrollView>
		);
	} else {
		const scrollingRows = pageRows.map((row): React.JSX.Element =>
			draggable ? (
				<SortableItem key={row.id} value={row.id} label={rowNameOf(row, firstColumnId)}>
					{renderRowPart(row, scrollingColumns, !hasPinnedBlock, true)}
				</SortableItem>
			) : (
				<React.Fragment key={row.id}>{renderRowPart(row, scrollingColumns, !hasPinnedBlock, false)}</React.Fragment>
			),
		);
		body = (
			<View className={cn(dataTableBodyVariants({ refetching: isRefetching }), "flex-row")}>
				{hasPinnedBlock ? (
					<View className="border-r border-border">
						{headerRow(pinnedColumns, true, false)}
						{pageRows.map((row): React.JSX.Element => (
							<React.Fragment key={row.id}>{renderRowPart(row, pinnedColumns, true, false)}</React.Fragment>
						))}
					</View>
				) : null}
				{/* At least as wide as the screen: the data cells grow into any room left, so the rows span it. */}
				<ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="grow">
					<View className="grow">
						{headerRow(scrollingColumns, !hasPinnedBlock, draggable)}
						{draggable ? (
							<Sortable value={pageRowIds} onValueChange={ignoreOrder} onValueCommit={handleReorder} getItemValue={identity}>
								{scrollingRows}
							</Sortable>
						) : (
							scrollingRows
						)}
					</View>
				</ScrollView>
			</View>
		);
	}

	const range = dataTablePageRangeOf(pageIndex, pageSize, totalCount);
	const showFooter = !isLoading && (error === undefined || error === null) && totalCount > 0 && !virtualizeRows;
	const bulkActionButtons = resolvedCheckbox.bulkActions.map((action): React.JSX.Element => (
		<BulkActionButton key={action.key} actionKey={action.key} label={action.label} icon={action.icon} destructive={action.variant === "destructive"} onRun={runBulkAction} />
	));

	return (
		<View ref={ref} testID={testID} accessibilityState={isRefetching ? BUSY : undefined} className={cn(dataTableVariants(), className)}>
			{title === undefined && description === undefined ? null : (
				<View className="gap-1">
					{title === undefined ? null : (
						<Text accessibilityRole="header" className="text-title font-sans-semibold text-foreground">
							{title}
						</Text>
					)}
					{description === undefined ? null : <Text className="text-body font-sans text-muted-foreground">{description}</Text>}
				</View>
			)}
			{searchKeys.length === 0 ? null : (
				<Input
					value={searchText}
					onChange={setSearchText}
					placeholder={labels.searchPlaceholder}
					accessibilityLabel={labels.searchAriaLabel}
					returnKeyType="search"
					leading={<Icon icon={SearchIcon} size="sm" colorClassName="accent-muted-foreground" />}
					trailing={searchText === "" ? null : <ClearSearchButton label={labels.clearSearchAriaLabel} onClear={setSearchText} />}
				/>
			)}
			{filters.length === 0 && !enableColumnVisibility && !enableColumnPinning && exportFormats.length === 0 && toolbarContent === undefined ? null : (
				<View className="flex-row flex-wrap gap-2">
					{filters.map((filter): React.JSX.Element => (
						<FilterMenu key={filter.key} filter={filter} value={filterValueOf(filter.key)} onChange={handleFilterChange} labels={labels} />
					))}
					{enableColumnVisibility || enableColumnPinning ? <ColumnsMenu columns={allColumns} headers={headers} pinning={enableColumnPinning} labels={labels} /> : null}
					{exportFormats.length === 0 ? null : <ExportMenu formats={exportFormats} onExport={handleExport} labels={labels} />}
					{toolbarContent}
				</View>
			)}
			{selectable && selectedCount > 0 ? (
				<View accessibilityLiveRegion="polite" className="gap-2 rounded-lg bg-muted p-3">
					<Text className="text-label font-sans-medium text-foreground">
						{selectAllPages
							? formatDataTableLabel(labels.allRowsSelected, { totalCount })
							: selectedCount === 1
								? labels.selectedRowCount
								: formatDataTableLabel(labels.selectedRowsCount, { count: selectedCount })}
					</Text>
					{allPageSelected && !selectAllPages && totalCount > pageRows.length ? (
						<Button label={formatDataTableLabel(labels.selectAllFilteredRows, { totalCount })} variant="link" size="sm" onPress={selectEveryRow} className="self-start" />
					) : null}
					<View className="flex-row flex-wrap gap-2">
						{bulkActionButtons}
						<Button label={labels.clearSelection} variant="ghost" size="sm" onPress={clearSelection} />
					</View>
				</View>
			) : null}
			{body}
			{showFooter ? (
				<View className="gap-2">
					<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
						{formatDataTableLabel(labels.showingResults, { from: range.from, to: range.to, total: totalCount })}
					</Text>
					<View className="flex-row flex-wrap items-center justify-between gap-2">
						<DropdownMenu
							label={formatDataTableLabel(labels.pageSizeOption, { count: pageSize })}
							title={labels.pageSizeTitle}
							items={pageSizeItems}
							onSelect={handlePageSize}
							size="sm"
						/>
						{pageCount > 1 ? (
							<Pagination
								page={pageIndex + 1}
								pageCount={pageCount}
								onChange={handlePageChange}
								pages="info"
								arrows="icons"
								size="sm"
								previousLabel={labels.previousPageAriaLabel}
								nextLabel={labels.nextPageAriaLabel}
								loading={isRefetching}
							/>
						) : null}
					</View>
				</View>
			) : null}
		</View>
	);
});

/** `accessibilityState` while a refetch runs. */
const BUSY = { busy: true };

/** A bulk action's button: runs the action by key. */
const BulkActionButton = React.memo(function BulkActionButton({
	actionKey,
	label,
	icon,
	destructive,
	onRun,
}: {
	readonly actionKey: string;
	readonly label: string;
	readonly icon: LucideIcon | undefined;
	readonly destructive: boolean;
	readonly onRun: (key: string) => void;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onRun(actionKey);
	}, [actionKey, onRun]);
	return <Button label={label} icon={icon} variant={destructive ? "destructive" : "outline"} size="sm" onPress={handlePress} />;
});

/** The search field's clear button. */
function ClearSearchButton({ label, onClear }: { readonly label: string; readonly onClear: (text: string) => void }): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onClear("");
	}, [onClear]);
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} onPress={handlePress} hitSlop={CLEAR_HIT_SLOP} className="active:opacity-60">
			<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
}

/** The clear button's extra touch area around its 16 pt glyph, to reach 44 pt (rules/04). */
const CLEAR_HIT_SLOP = 14;

/** A card row: the card, with a selection box before it when rows select. */
function CardRow({
	row,
	selectable,
	selected,
	onToggleSelected,
	rowName,
	labels,
	children,
}: {
	readonly row: Row<DataTableFeatures, RowData>;
	readonly selectable: boolean;
	readonly selected: boolean;
	readonly onToggleSelected: (row: Row<DataTableFeatures, RowData>, selected: boolean) => void;
	readonly rowName: string;
	readonly labels: NativeDataTableLabels;
	readonly children: React.ReactNode;
}): React.ReactNode {
	const handleSelected = React.useCallback(
		(checked: boolean): void => {
			onToggleSelected(row, checked);
		},
		[onToggleSelected, row],
	);
	if (!selectable) {
		return children;
	}
	return (
		<View className="flex-row items-start gap-2">
			<Checkbox label={formatDataTableLabel(labels.selectNamedRow, { row: rowName })} labelHidden checked={selected} onChange={handleSelected} size="sm" />
			<View className="flex-1">{children}</View>
		</View>
	);
}

/** The table, generic over its rows. */
export const DataTable: DataTableComponent = React.memo(DataTableBase);
