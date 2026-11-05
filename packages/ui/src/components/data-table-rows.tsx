"use client";

// DataTable's header, cells, rows and their states (enhancement 8.1: split from data-table.tsx): inline editing,
// drag handles, selection checkboxes, row actions, the mobile cards, loading rows and the empty result.

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { TableCell, TableHead, TableRow } from "@workspace/ui/components/table";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { type Cell, type Header, type Row, type RowData, type RowSelectionState, Subscribe, type Table as TanStackTable, flexRender } from "@tanstack/react-table";
import { GripVertical, MoreHorizontal, Pencil, Pin, PinOff, Search } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { type DataTableLabels } from "@workspace/ui/lib/data-table/labels";
import { buildPinnedColumnStyles, cellValueDisplayString, getSortIcon, memoGeneric } from "./data-table-shared";
import { type Action, type DataTableFeatures, type EditingCell } from "./data-table-types";

export const InlineEditInput = React.memo(function InlineEditInput({
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

export const DragHandleCell = React.memo(function DragHandleCell({ isDragged }: { readonly isDragged?: boolean }): React.JSX.Element {
	return (
		<div className={cn("flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground", isDragged === true && "cursor-grabbing text-primary")}>
			<GripVertical className="h-4 w-4" />
		</div>
	);
});

// ── Selection Checkboxes (sub-components: per-row closures live inside, never inline) ─

export interface SelectAllCheckboxProps<TData extends RowData> {
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly onAnyDeselect: () => void;
	readonly labels: DataTableLabels;
}

export const SelectAllCheckbox = memoGeneric(function SelectAllCheckbox<TData extends RowData>({
	table,
	onAnyDeselect,
	labels,
}: SelectAllCheckboxProps<TData>): React.JSX.Element {
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

export interface SelectRowCheckboxProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly onAnyDeselect: () => void;
	readonly labels: DataTableLabels;
	readonly className?: string;
}

export const SelectRowCheckbox = memoGeneric(function SelectRowCheckbox<TData extends RowData>({
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
	const handleStopPropagation = useCallback((event: React.SyntheticEvent): void => {
		event.stopPropagation();
	}, []);
	const renderCheckbox = (isSelected: boolean): React.JSX.Element => (
		<div onClick={handleStopPropagation} onKeyDown={handleStopPropagation} role="presentation">
			<Checkbox checked={isSelected} onCheckedChange={handleCheckedChange} aria-label={labels.selectRowAriaLabel} className={className} />
		</div>
	);
	return (
		<Subscribe source={table.atoms.rowSelection} selector={isRowSelected}>
			{renderCheckbox}
		</Subscribe>
	);
});

// ── Row Actions Dropdown (sub-component: row + actions arrive as props) ─────

export interface RowActionsMenuProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly actions: Action<TData>[];
	readonly labels: DataTableLabels;
}

export const RowActionsMenu = memoGeneric(function RowActionsMenu<TData extends RowData>({ row, actions, labels }: RowActionsMenuProps<TData>): React.JSX.Element {
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
					{/* Each row carries its own emphasis (an icon tile and a description), so the highlight is the soft wash, never the inverted pill. */}
					{actions.map((action) => (
						<DropdownMenuItem
							key={action.key}
							data-action-key={action.key}
							onClick={handleActionClick}
							highlight="soft"
							variant={action.isDestructive === true ? "destructive" : "default"}
							className={cn("flex cursor-pointer items-center gap-3 rounded-md p-3", action.className)}>
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

export interface HeaderCellProps<TData extends RowData> {
	readonly header: Header<DataTableFeatures, TData>;
	readonly enableColumnPinning: boolean;
	readonly sortCycle: "asc-desc" | "asc-desc-none";
	readonly onTogglePin: (columnId: string) => void;
	readonly labels: DataTableLabels;
}

export const HeaderCell = memoGeneric(function HeaderCell<TData extends RowData>({
	header,
	enableColumnPinning,
	sortCycle,
	onTogglePin,
	labels,
}: HeaderCellProps<TData>): React.JSX.Element {
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
	const sorted = column.getIsSorted();
	const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";

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
			aria-sort={column.getCanSort() ? ariaSort : undefined}
			className={cn("h-11 bg-muted/30 px-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase", isPinned && "sticky")}>
			<div className="flex w-full items-center gap-1.5">
				{header.isPlaceholder ? null : column.getCanSort() ? (
					<button type="button" onClick={handleHeaderClick} className="flex w-full items-center gap-1.5 text-left hover:text-foreground">
						{flexRender(column.columnDef.header, header.getContext())}
						<span className="flex shrink-0 items-center">{getSortIcon(column)}</span>
					</button>
				) : (
					flexRender(column.columnDef.header, header.getContext())
				)}

				{enableColumnPinning && column.getCanPin() ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handlePinClick}
						className="ml-1 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
						aria-label={column.getIsPinned() ? labels.unpinColumnAriaLabel : labels.pinColumnAriaLabel}>
						{column.getIsPinned() ? <PinOff className="h-3 w-3 text-muted-foreground" /> : <Pin className="h-3 w-3 text-muted-foreground" />}
					</Button>
				) : null}
			</div>
		</TableHead>
	);
});

// ── Table Cell (sub-component: the per-cell edit closures live here) ─────────

export interface TableCellViewProps<TData extends RowData> {
	readonly cell: Cell<DataTableFeatures, TData>;
	readonly rowIdx: number;
	readonly editableSet: ReadonlySet<string>;
	readonly editingCell: EditingCell | null;
	readonly onCellDoubleClick: (rowIndex: number, columnId: string) => void;
	readonly onCellEditSave: (rowIndex: number, columnId: string, value: string, row: TData) => void;
	readonly onCellEditCancel: () => void;
}

export const TableCellView = memoGeneric(function TableCellView<TData extends RowData>({
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
	const isEditing = editingCell?.rowIndex === rowIdx && editingCell.columnId === cellId;

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

export interface TableRowViewProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly rowIdx: number;
	readonly rowHeight?: number | undefined;
	// Selection highlight — supplied by the per-row `table.Subscribe` island,
	// because row objects are cached (stable identity) and `row.getIsSelected()`
	// would otherwise go stale inside the memoized row (bugfix #2).
	readonly isRowSelected: boolean;
	readonly draggable: boolean;
	readonly editableSet: ReadonlySet<string>;
	readonly editingCell: EditingCell | null;
	readonly dragIndex: number | null;
	readonly dragOverIndex: number | null;
	readonly onRowClick?: ((row: TData) => void) | undefined;
	readonly onDragStart: (e: React.DragEvent, index: number) => void;
	readonly onDragOver: (e: React.DragEvent, index: number) => void;
	readonly onDrop: (e: React.DragEvent, index: number) => void;
	readonly onDragEnd: () => void;
	readonly onCellDoubleClick: (rowIndex: number, columnId: string) => void;
	readonly onCellEditSave: (rowIndex: number, columnId: string, value: string, row: TData) => void;
	readonly onCellEditCancel: () => void;
}

export const TableRowView = memoGeneric(function TableRowView<TData extends RowData>({
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
				if (e.key === " ") {
					e.preventDefault();
				}
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

export interface MobileCardViewProps<TData extends RowData> {
	readonly row: Row<DataTableFeatures, TData>;
	readonly table: TanStackTable<DataTableFeatures, TData>;
	readonly enableBulkSelection: boolean;
	readonly mobileCardRender: (item: TData, actions?: Action<TData>[]) => React.ReactNode;
	readonly actions: Action<TData>[];
	readonly labels: DataTableLabels;
	readonly onAnyDeselect: () => void;
	readonly onRowClick?: ((row: TData) => void) | undefined;
}

export const MobileCardView = memoGeneric(function MobileCardView<TData extends RowData>({
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

export interface SkeletonRowProps {
	readonly cells: number;
	readonly height?: number | undefined;
}

export const SkeletonRow = React.memo(function SkeletonRow({ cells, height }: SkeletonRowProps): React.JSX.Element {
	const skeletonStyle = useMemo((): React.CSSProperties | undefined => {
		return height !== undefined ? { height } : undefined;
	}, [height]);

	return (
		<TableRow>
			{Array.from({ length: cells }, (_, index) => (
				<TableCell key={index} className="p-4">
					<Skeleton variant="text" className="h-4" style={skeletonStyle} />
				</TableCell>
			))}
		</TableRow>
	);
});

// ── Bulk Selection Bar (shared by the desktop banner + mobile bar) ──────────

export interface NoResultsProps {
	readonly labels: DataTableLabels;
	readonly onClearFilters: () => void;
}

export const NoResults = React.memo(function NoResults({ labels, onClearFilters }: NoResultsProps): React.JSX.Element {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Search className="h-6 w-6" />
				</EmptyMedia>
				<EmptyTitle>{labels.noResultsTitle}</EmptyTitle>
				<EmptyDescription>{labels.noResultsDescription}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" onClick={onClearFilters}>
					{labels.clearFilters}
				</Button>
			</EmptyContent>
		</Empty>
	);
});

// ── Bulk selection chrome (neutral surface — plays nice with outline/destructive buttons) ─
