// The data grid's parts, each reading the grid it sits in (`DataGrid`): a column's header (`DataGridColumnHeader`, a
// sort button, or a menu that sorts, pins, moves and shows or hides columns, as the layout allows), the pager
// (`DataGridPagination`), the list of columns to show (`DataGridColumnVisibility`), and the row controls a column's
// cells draw: a selection checkbox (`DataGridRowSelect`, `DataGridRowSelectAll` in the header), an expand button
// (`DataGridRowExpand`), a pin (`DataGridRowPin`) and a drag handle (`DataGridRowHandle`).
//
// A part names its row or column by id (`row={row}` with the cell's TanStack row fits, as on the web) and reads the
// typed row or column from its grid: a TanStack row is invariant in its data type, so a memoised part could not take
// it as a prop of any one type.

import type { RowData, SortDirection } from "@tanstack/react-table";
import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import ArrowUpDownIcon from "lucide-react-native/icons/arrow-up-down";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import Columns3Icon from "lucide-react-native/icons/columns-3";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import PinIcon from "lucide-react-native/icons/pin";
import PinOffIcon from "lucide-react-native/icons/pin-off";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { dataGridColumnLabel, dataGridMovedColumnOrder, type DataGridColumn, type DataGridCoreTable, type DataGridRow, type DataGridTableInstance } from "../lib/data-grid";
import { Checkbox } from "./checkbox";
import { useDataGrid, type DataGridGridVisitor, type DataGridTypedGrid } from "./data-grid";
import { DropdownMenu, DropdownMenuSheet, type DropdownMenuItemData } from "./dropdown-menu";
import { Icon, type LucideIcon } from "./icon";
import { Pagination } from "./pagination";
import { SortableItemHandle } from "./sortable";

// ── Column header ──────────────────────────────────────────────────────────

const COLUMN_PREFIX = "column:";

const SORT_ICONS: Readonly<Record<SortDirection, LucideIcon>> = { asc: ArrowUpIcon, desc: ArrowDownIcon };

/** A row as a part names it: any TanStack row of the grid (its id is all the part reads). */
export interface DataGridRowReference {
	readonly id: string;
}

/** A column as a part names it: any TanStack column of the grid. */
export interface DataGridColumnReference {
	readonly id: string;
}

export const dataGridColumnHeaderVariants = cva("-mx-1 rounded-sm px-1 py-1", {
	variants: { interactive: { true: "active:bg-muted", false: "" } },
	defaultVariants: { interactive: true },
});

export const dataGridRowControlVariants = cva("size-6 items-center justify-center rounded-sm active:bg-muted");

export interface DataGridColumnHeaderProps {
	readonly column: DataGridColumnReference;
	/** The header's text. Default: the column's name. */
	readonly title?: string | undefined;
	/** A glyph before the title. */
	readonly icon?: LucideIcon | undefined;
	/** The menu lists every column to show or hide (with the layout's `columnsVisibility`). */
	readonly visibility?: boolean | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The menu's items for one column, as the layout and the column allow. */
function headerItems<TData extends RowData>(
	column: DataGridColumn<TData>,
	table: DataGridCoreTable<TData>,
	options: { readonly pinnable: boolean; readonly movable: boolean; readonly visibility: boolean },
	labels: ReturnType<typeof useDataGrid>["labels"],
): readonly DropdownMenuItemData<string>[] {
	const items: DropdownMenuItemData<string>[] = [];
	const sorted = column.getIsSorted();
	if (column.getCanSort()) {
		items.push(
			{ value: "asc", label: labels.sortAscending, icon: ArrowUpIcon, kind: "radio", checked: sorted === "asc" },
			{ value: "desc", label: labels.sortDescending, icon: ArrowDownIcon, kind: "radio", checked: sorted === "desc" },
		);
	}
	if (options.pinnable && column.getCanPin()) {
		const pinned = column.getIsPinned();
		items.push(
			pinned === false
				? { value: "pinStart", label: labels.pinColumnStart, icon: PinIcon, group: "Pin" }
				: { value: "unpin", label: labels.unpinColumn(dataGridColumnLabel(column)), icon: PinOffIcon, group: "Pin" },
		);
		if (pinned === false) {
			items.push({ value: "pinEnd", label: labels.pinColumnEnd, icon: PinIcon, group: "Pin" });
		}
	}
	if (options.movable && column.getIsPinned() === false) {
		items.push(
			{ value: "moveStart", label: labels.moveColumnStart, icon: ArrowLeftIcon, group: "Move", disabled: dataGridMovedColumnOrder(table, column.id, -1) === null },
			{ value: "moveEnd", label: labels.moveColumnEnd, icon: ArrowRightIcon, group: "Move", disabled: dataGridMovedColumnOrder(table, column.id, 1) === null },
		);
	}
	if (options.visibility) {
		items.push({
			value: "columns",
			label: labels.columnsMenu,
			icon: Columns3Icon,
			items: table
				.getAllLeafColumns()
				.filter((candidate): boolean => candidate.getCanHide())
				.map((candidate): DropdownMenuItemData<string> => ({
					value: `${COLUMN_PREFIX}${candidate.id}`,
					label: dataGridColumnLabel(candidate),
					kind: "checkbox",
					checked: candidate.getIsVisible(),
				})),
		});
	}
	return items;
}

/** Carries out a menu choice on the column (or the column the show/hide list names). */
function applyHeaderAction<TData extends RowData>(column: DataGridColumn<TData>, table: DataGridCoreTable<TData>, value: string): void {
	if (value.startsWith(COLUMN_PREFIX)) {
		table.getColumn(value.slice(COLUMN_PREFIX.length))?.toggleVisibility();
		return;
	}
	switch (value) {
		case "asc":
			column.toggleSorting(false);
			return;
		case "desc":
			column.toggleSorting(true);
			return;
		case "pinStart":
			column.pin("start");
			return;
		case "pinEnd":
			column.pin("end");
			return;
		case "unpin":
			column.pin(false);
			return;
		case "moveStart":
		case "moveEnd": {
			const order = dataGridMovedColumnOrder(table, column.id, value === "moveStart" ? -1 : 1);
			if (order !== null) {
				table.setColumnOrder([...order]);
			}
			return;
		}
		default:
	}
}

/**
 * A column's header: a button that steps its sort (ascending, descending, none) when that is all it can do, else a
 * button that opens a menu to sort, pin, move and show or hide columns, as the grid's layout allows.
 */
export const DataGridColumnHeader = React.memo(
	React.forwardRef<ViewInstance, DataGridColumnHeaderProps>(function DataGridColumnHeader(props, ref): React.JSX.Element | null {
		const { withGrid } = useDataGrid();
		const visitor = React.useMemo(
			(): DataGridGridVisitor<React.JSX.Element | null> => ({
				visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element | null => {
					const column = grid.table.getColumn(props.column.id);
					return column === undefined ? null : <ColumnHeader viewRef={ref} column={column} options={props} />;
				},
			}),
			[props, ref],
		);
		return withGrid(visitor);
	}),
);

interface ColumnHeaderProps<TData extends RowData> {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly column: DataGridColumn<TData>;
	readonly options: DataGridColumnHeaderProps;
}

function ColumnHeader<TData extends RowData>({
	viewRef,
	column,
	options: { title, icon, visibility = false, className, testID },
}: ColumnHeaderProps<TData>): React.JSX.Element {
	const { layout, labels } = useDataGrid();
	const [open, setOpen] = React.useState(false);
	const { table } = column;
	const name = title ?? dataGridColumnLabel(column);
	const sorted = column.getIsSorted();
	const canSort = column.getCanSort();
	const options = { pinnable: layout.columnsPinnable, movable: layout.columnsMovable, visibility: visibility && layout.columnsVisibility };
	const hasMenu = (options.pinnable && column.getCanPin()) || options.movable || options.visibility;
	const items = hasMenu ? headerItems(column, table, options, labels) : [];
	const press = React.useCallback((): void => {
		if (hasMenu) {
			setOpen(true);
		} else {
			column.toggleSorting();
		}
	}, [column, hasMenu]);
	const close = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const choose = React.useCallback(
		(value: string): void => {
			applyHeaderAction(column, table, value);
		},
		[column, table],
	);
	const sortIcon = sorted === false ? ArrowUpDownIcon : SORT_ICONS[sorted];
	const sortWord = sorted === false ? undefined : sorted === "asc" ? labels.sortAscending : labels.sortDescending;
	const label = (
		<View className="flex-row items-center gap-1.5">
			{icon === undefined ? null : <Icon icon={icon} size="xs" colorClassName="accent-muted-foreground" />}
			<Text numberOfLines={1} className={cn("text-caption font-sans-medium", sorted === false ? "text-muted-foreground" : "text-foreground")}>
				{name}
			</Text>
			{canSort ? <Icon icon={sortIcon} size="xs" colorClassName={sorted === false ? "accent-muted-foreground" : "accent-primary"} /> : null}
			{column.getIsPinned() === false ? null : <Icon icon={PinIcon} size="xs" colorClassName="accent-muted-foreground" />}
		</View>
	);
	if (!canSort && !hasMenu) {
		return (
			<View
				ref={viewRef}
				accessible
				accessibilityRole="header"
				accessibilityLabel={name}
				testID={testID}
				className={cn(dataGridColumnHeaderVariants({ interactive: false }), className)}>
				{label}
			</View>
		);
	}
	const accessibilityValue = sortWord === undefined ? undefined : { text: sortWord };
	return (
		<>
			<Pressable
				ref={viewRef}
				onPress={press}
				accessibilityRole="button"
				accessibilityLabel={name}
				accessibilityValue={accessibilityValue}
				accessibilityHint={hasMenu ? labels.columnOptions(name) : undefined}
				hitSlop={8}
				testID={testID}
				className={cn(dataGridColumnHeaderVariants(), className)}>
				{label}
			</Pressable>
			{hasMenu ? <DropdownMenuSheet visible={open} title={name} items={items} onSelect={choose} onClose={close} /> : null}
		</>
	);
}

// ── Pagination ─────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZES: readonly number[] = [5, 10, 25, 50, 100];

export interface DataGridPaginationProps {
	/** The page sizes on offer. */
	readonly sizes?: readonly number[] | undefined;
	/** Leave out the rows-per-page menu. */
	readonly hideSizes?: boolean | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The pager: rows per page, "1 - 5 of 20", and the pages. */
export const DataGridPagination = React.memo(
	React.forwardRef<ViewInstance, DataGridPaginationProps>(function DataGridPagination(props, ref): React.JSX.Element {
		const { withGrid } = useDataGrid();
		const visitor = React.useMemo(
			(): DataGridGridVisitor<React.JSX.Element> => ({
				visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element => <GridPagination viewRef={ref} table={grid.table} options={props} />,
			}),
			[props, ref],
		);
		return withGrid(visitor);
	}),
);

interface GridPaginationProps<TData extends RowData> {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly table: DataGridTableInstance<TData>;
	readonly options: DataGridPaginationProps;
}

function GridPagination<TData extends RowData>({ viewRef, table, options }: GridPaginationProps<TData>): React.JSX.Element {
	const { labels, recordCount, isLoading } = useDataGrid();
	const { sizes = DEFAULT_PAGE_SIZES, hideSizes = false, className, testID } = options;
	const { pageIndex, pageSize } = table.state.pagination;
	const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1;
	const to = Math.min(recordCount, (pageIndex + 1) * pageSize);
	const pageCount = Math.max(1, table.getPageCount());
	const items = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			sizes.map((size: number): DropdownMenuItemData<string> => ({ value: String(size), label: String(size), kind: "radio", checked: size === pageSize })),
		[pageSize, sizes],
	);
	const changeSize = React.useCallback(
		(value: string): void => {
			table.setPageSize(Number(value));
		},
		[table],
	);
	const changePage = React.useCallback(
		(page: number): void => {
			table.setPageIndex(page - 1);
		},
		[table],
	);
	return (
		<View ref={viewRef} className={cn("w-full gap-2", className)} testID={testID}>
			<View className="flex-row flex-wrap items-center justify-between gap-2">
				{hideSizes ? null : (
					<View className="flex-row items-center gap-2">
						<Text className="text-caption font-sans text-muted-foreground">{labels.rowsPerPage}</Text>
						<DropdownMenu label={String(pageSize)} title={labels.rowsPerPage} items={items} onSelect={changeSize} size="sm" variant="outline" disabled={isLoading} />
					</View>
				)}
				<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
					{labels.paginationInfo({ from, to, count: recordCount })}
				</Text>
			</View>
			{pageCount > 1 ? <Pagination page={pageIndex + 1} pageCount={pageCount} onChange={changePage} size="sm" /> : null}
		</View>
	);
}

// ── Column visibility ──────────────────────────────────────────────────────

export interface DataGridColumnVisibilityProps {
	/** The button's text. Default: the labels' `columnsMenu`. */
	readonly label?: string | undefined;
	readonly testID?: string | undefined;
}

/** A menu button that shows or hides each column that can be hidden. */
export const DataGridColumnVisibility = React.memo(
	React.forwardRef<ViewInstance, DataGridColumnVisibilityProps>(function DataGridColumnVisibility({ label, testID }, ref): React.JSX.Element {
		const { withGrid, labels } = useDataGrid();
		const visitor = React.useMemo(
			(): DataGridGridVisitor<React.JSX.Element> => ({
				visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element => (
					<ColumnVisibility viewRef={ref} table={grid.table} label={label ?? labels.columnsMenu} title={labels.toggleColumns} testID={testID} />
				),
			}),
			[label, labels.columnsMenu, labels.toggleColumns, ref, testID],
		);
		return withGrid(visitor);
	}),
);

function ColumnVisibility<TData extends RowData>({
	viewRef,
	table,
	label,
	title,
	testID,
}: {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly table: DataGridCoreTable<TData>;
	readonly label: string;
	readonly title: string;
	readonly testID: string | undefined;
}): React.JSX.Element {
	const items = table
		.getAllLeafColumns()
		.filter((column): boolean => column.getCanHide())
		.map((column): DropdownMenuItemData<string> => ({ value: column.id, label: dataGridColumnLabel(column), kind: "checkbox", checked: column.getIsVisible() }));
	const toggle = React.useCallback(
		(id: string): void => {
			table.getColumn(id)?.toggleVisibility();
		},
		[table],
	);
	return <DropdownMenu ref={viewRef} label={label} title={title} items={items} onSelect={toggle} icon={Columns3Icon} size="sm" variant="outline" testID={testID} />;
}

// ── Row controls ───────────────────────────────────────────────────────────

export interface DataGridRowPartProps {
	/** The cell's row (`row` in a column's `cell`). */
	readonly row: DataGridRowReference;
	readonly testID?: string | undefined;
}

/** A row part's drawing, given the typed row it names. */
interface TypedRowPartProps<TData extends RowData> {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly row: DataGridRow<TData>;
	readonly testID: string | undefined;
}

/** Hands a row part's drawing the typed row it names. */
interface RowPartDrawing {
	draw<TData extends RowData>(props: TypedRowPartProps<TData>): React.JSX.Element | null;
}

/** Draws a row part with the grid's typed row of the id it names. */
function useRowPart(drawing: RowPartDrawing, { row, testID }: DataGridRowPartProps, ref: React.ForwardedRef<ViewInstance>): React.JSX.Element | null {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element | null> => ({
			visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element | null => drawing.draw({ viewRef: ref, row: grid.table.getRow(row.id, true), testID }),
		}),
		[drawing, ref, row.id, testID],
	);
	return withGrid(visitor);
}

function RowSelect<TData extends RowData>({ viewRef, row, testID }: TypedRowPartProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const change = React.useCallback(
		(checked: boolean): void => {
			row.toggleSelected(checked);
		},
		[row],
	);
	return (
		<Checkbox ref={viewRef} label={labels.selectRow} labelHidden checked={row.getIsSelected()} disabled={!row.getCanSelect()} onChange={change} size="sm" testID={testID} />
	);
}

const ROW_SELECT: RowPartDrawing = { draw: (props) => <RowSelect {...props} /> };

/** A row's selection checkbox. */
export const DataGridRowSelect = React.memo(
	React.forwardRef<ViewInstance, DataGridRowPartProps>(function DataGridRowSelect(props, ref): React.JSX.Element | null {
		return useRowPart(ROW_SELECT, props, ref);
	}),
);

export interface DataGridRowSelectAllProps {
	readonly testID?: string | undefined;
}

/** The header's checkbox: every row on the page, part-checked when some are. */
export const DataGridRowSelectAll = React.memo(
	React.forwardRef<ViewInstance, DataGridRowSelectAllProps>(function DataGridRowSelectAll({ testID }, ref): React.JSX.Element {
		const { withGrid } = useDataGrid();
		const visitor = React.useMemo(
			(): DataGridGridVisitor<React.JSX.Element> => ({
				visit: <TData extends RowData>(grid: DataGridTypedGrid<TData>): React.JSX.Element => <RowSelectAll viewRef={ref} table={grid.table} testID={testID} />,
			}),
			[ref, testID],
		);
		return withGrid(visitor);
	}),
);

function RowSelectAll<TData extends RowData>({
	viewRef,
	table,
	testID,
}: {
	readonly viewRef: React.ForwardedRef<ViewInstance>;
	readonly table: DataGridCoreTable<TData>;
	readonly testID: string | undefined;
}): React.JSX.Element {
	const { labels } = useDataGrid();
	const change = React.useCallback(
		(checked: boolean): void => {
			table.toggleAllPageRowsSelected(checked);
		},
		[table],
	);
	const all = table.getIsAllPageRowsSelected();
	const some = table.getIsSomePageRowsSelected();
	return <Checkbox ref={viewRef} label={labels.selectAll} labelHidden checked={all} indeterminate={some ? !all : false} onChange={change} size="sm" testID={testID} />;
}

function RowExpand<TData extends RowData>({ viewRef, row, testID }: TypedRowPartProps<TData>): React.JSX.Element | null {
	const { labels } = useDataGrid();
	const toggle = React.useCallback((): void => {
		row.toggleExpanded();
	}, [row]);
	if (!row.getCanExpand()) {
		return null;
	}
	const expanded = row.getIsExpanded();
	const accessibilityState = { expanded };
	return (
		<Pressable
			ref={viewRef}
			onPress={toggle}
			accessibilityRole="button"
			accessibilityLabel={expanded ? labels.collapseRow : labels.expandRow}
			accessibilityState={accessibilityState}
			hitSlop={10}
			testID={testID}
			className={dataGridRowControlVariants()}>
			<Icon icon={expanded ? ChevronDownIcon : ChevronRightIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
}

const ROW_EXPAND: RowPartDrawing = { draw: (props) => <RowExpand {...props} /> };

/** A row's expand button: opens its detail or its child rows (nothing for a row that cannot expand). */
export const DataGridRowExpand = React.memo(
	React.forwardRef<ViewInstance, DataGridRowPartProps>(function DataGridRowExpand(props, ref): React.JSX.Element | null {
		return useRowPart(ROW_EXPAND, props, ref);
	}),
);

function RowPin<TData extends RowData>({ viewRef, row, testID }: TypedRowPartProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const pinned = row.getIsPinned() !== false;
	const toggle = React.useCallback((): void => {
		row.pin(pinned ? false : "top");
	}, [pinned, row]);
	const accessibilityState = { selected: pinned };
	return (
		<Pressable
			ref={viewRef}
			onPress={toggle}
			accessibilityRole="button"
			accessibilityLabel={pinned ? labels.unpinRow : labels.pinRow}
			accessibilityState={accessibilityState}
			hitSlop={10}
			testID={testID}
			className={dataGridRowControlVariants()}>
			<Icon icon={pinned ? PinOffIcon : PinIcon} size="sm" colorClassName={pinned ? "accent-primary" : "accent-muted-foreground"} />
		</Pressable>
	);
}

const ROW_PIN: RowPartDrawing = { draw: (props) => <RowPin {...props} /> };

/** A row's pin: keeps it above the other rows. */
export const DataGridRowPin = React.memo(
	React.forwardRef<ViewInstance, DataGridRowPartProps>(function DataGridRowPin(props, ref): React.JSX.Element | null {
		return useRowPart(ROW_PIN, props, ref);
	}),
);

export interface DataGridRowHandleProps {
	readonly testID?: string | undefined;
}

/** A row's drag handle (with the layout's `rowsDraggable`): drag it, or use its move actions. */
export const DataGridRowHandle = React.memo(
	React.forwardRef<ViewInstance, DataGridRowHandleProps>(function DataGridRowHandle({ testID }, ref): React.JSX.Element {
		return (
			<SortableItemHandle ref={ref} testID={testID}>
				<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
			</SortableItemHandle>
		);
	}),
);
