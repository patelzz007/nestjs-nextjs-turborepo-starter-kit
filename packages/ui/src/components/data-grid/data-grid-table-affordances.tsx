"use client";

// The data grid table's states and row affordances (enhancement 8.1: split from data-grid-table.tsx): empty, loading, pin, select and expand.

import { hasGlobalConstructor } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { type DataGridCoreTable, type DataGridGridVisitor, useDataGrid } from "@workspace/ui/components/data-grid/data-grid";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData, Subscribe } from "@tanstack/react-table";
import { ChevronDownIcon, PinIcon, PinOffIcon } from "lucide-react";
import * as React from "react";
import {
	DEFAULT_TREE_INDENT_PX,
	type DataGridRow,
	type DataGridStyle,
	FILL_COLUMN_SPAN,
	OVERFLOW_TOLERANCE_PX,
	VISIBLE_LEAF_COUNT_VISITOR,
	getDataGridScrollAreaViewport,
	getDataGridTreeIndentStyle,
} from "./data-grid-table-layout";

/** The empty-state row: `emptyMessage`, else the `empty` label, centred on the visible part of the viewport. */
export const DataGridTableEmpty = React.forwardRef<HTMLTableRowElement, Omit<React.ComponentProps<"tr">, "children">>(function DataGridTableEmpty(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps, withGrid } = useDataGrid();
	const stopObserverRef = React.useRef<(() => void) | null>(null);
	const columnCount = withGrid(VISIBLE_LEAF_COUNT_VISITOR) + (gridProps.tableLayout.columnsResizable ? FILL_COLUMN_SPAN : 0);

	// On a table wider than its viewport the message would centre off-screen; a
	// sticky box sized to the viewport (only while the table overflows) centres it on what is visible.
	const handleMessageRef = React.useCallback((node: HTMLDivElement | null): void => {
		stopObserverRef.current?.();
		stopObserverRef.current = null;
		if (node === null || !hasGlobalConstructor("ResizeObserver")) {
			return;
		}
		const scrollViewport = getDataGridScrollAreaViewport(node) ?? node.closest('[data-slot="data-grid-table-viewport"]')?.parentElement ?? null;
		if (scrollViewport === null) {
			return;
		}
		const measure = (): void => {
			const overflows = scrollViewport.scrollWidth > scrollViewport.clientWidth + OVERFLOW_TOLERANCE_PX;
			node.style.width = overflows ? `${String(scrollViewport.clientWidth)}px` : "";
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scrollViewport);
		const tableNode = node.closest("table");
		if (tableNode !== null) {
			observer.observe(tableNode);
		}
		stopObserverRef.current = (): void => {
			observer.disconnect();
		};
	}, []);

	return (
		<tr ref={ref} className={className} {...props}>
			<td colSpan={Math.max(columnCount, 1)} className="py-6 text-center text-sm text-muted-foreground">
				<div ref={handleMessageRef} data-slot="data-grid-table-empty" className="sticky start-0">
					{gridProps.emptyMessage ?? labels.empty}
				</div>
			</td>
		</tr>
	);
});

/** A floating loading badge, for grids that overlay their loading state instead of replacing the body. */
export const DataGridTableLoader = React.forwardRef<HTMLDivElement, Omit<React.ComponentProps<"div">, "children">>(function DataGridTableLoader(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps } = useDataGrid();
	return (
		<div ref={ref} className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", className)} {...props}>
			<div role="status" className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm leading-none font-medium text-muted-foreground">
				<Spinner aria-hidden className="size-5 opacity-60" />
				{gridProps.loadingMessage ?? labels.loading}
			</div>
		</div>
	);
});

// ── Row affordances (rendered by column defs) ──────────────────────────────

export interface DataGridTableRowAffordanceProps<TData extends RowData> {
	readonly row: DataGridRow<TData>;
}

/** Row pin toggle: pins the row to the top, or unpins it. */
export function DataGridTableRowPin<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const isPinned = row.getIsPinned() !== false;
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Pinning must not bubble into the row's onRowClick handler.
			event.stopPropagation();
			row.pin(isPinned ? false : "top");
		},
		[row, isPinned],
	);
	return (
		<button
			type="button"
			aria-label={isPinned ? labels.unpinRow : labels.pinRow}
			aria-pressed={isPinned}
			onClick={handleClick}
			className={cn(
				"inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
				isPinned ? "text-primary hover:text-primary/80" : undefined,
			)}>
			{isPinned ? <PinOffIcon className="size-4" aria-hidden="true" /> : <PinIcon className="size-4" aria-hidden="true" />}
		</button>
	);
}

export function stopPropagation(event: React.MouseEvent<HTMLElement>): void {
	// Selection must not bubble into the row's onRowClick handler.
	event.stopPropagation();
}

export function DataGridTableRowSelectCheckbox<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			row.toggleSelected(checked);
		},
		[row],
	);
	const isSelected = row.getIsSelected();
	const isIndeterminate = row.getIsSomeSelected() && !isSelected;
	return (
		<Checkbox
			checked={isSelected}
			indeterminate={isIndeterminate}
			onCheckedChange={handleCheckedChange}
			onClick={stopPropagation}
			aria-label={labels.selectRow}
			className="align-[inherit]"
		/>
	);
}

/**
 * Row selection checkbox. Subscribes to the row-selection atom, so selection
 * is a render dependency of its own even inside a cached cell template.
 */
export function DataGridTableRowSelect<TData extends RowData>({ row }: DataGridTableRowAffordanceProps<TData>): React.JSX.Element {
	return <Subscribe source={row.table.atoms.rowSelection}>{() => <DataGridTableRowSelectCheckbox row={row} />}</Subscribe>;
}

export function DataGridTableRowSelectAllCheckbox<TData extends RowData>({ table }: { readonly table: DataGridCoreTable<TData> }): React.JSX.Element {
	const { labels, recordCount, isLoading } = useDataGrid();
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			table.toggleAllPageRowsSelected(checked);
		},
		[table],
	);
	// `getIsSomePageRowsSelected()` means "at least one" in v9, so the all-selected case is excluded explicitly.
	const isAllSelected = table.getIsAllPageRowsSelected();
	const isIndeterminate = table.getIsSomePageRowsSelected() && !isAllSelected;
	const isDisabled = isLoading || recordCount === 0;
	return (
		<Checkbox
			checked={isAllSelected}
			indeterminate={isIndeterminate}
			disabled={isDisabled}
			onCheckedChange={handleCheckedChange}
			aria-label={labels.selectAll}
			className="align-[inherit]"
		/>
	);
}

export const SELECT_ALL_VISITOR: DataGridGridVisitor<React.JSX.Element> = {
	visit: (grid) => {
		const { table } = grid;
		return <Subscribe source={table.atoms.rowSelection}>{() => <DataGridTableRowSelectAllCheckbox table={table} />}</Subscribe>;
	},
};

/** Header select-all checkbox for the current page. */
export function DataGridTableRowSelectAll(): React.JSX.Element {
	return useDataGrid().withGrid(SELECT_ALL_VISITOR);
}

export interface DataGridTableRowExpandProps<TData extends RowData> extends DataGridTableRowAffordanceProps<TData> {
	/** Horizontal offset in px per tree depth level. */
	readonly indent?: number;
	readonly className?: string;
	/** Custom toggle icon; replaces the default chevron. */
	readonly children?: React.ReactNode;
}

/** Row expansion toggle with tree indentation (a compact spacer for leaf rows). */
export function DataGridTableRowExpand<TData extends RowData>({
	row,
	indent = DEFAULT_TREE_INDENT_PX,
	className,
	children,
}: DataGridTableRowExpandProps<TData>): React.JSX.Element {
	const { labels, props } = useDataGrid();
	const isExpanded = row.getIsExpanded();
	const indentStyle = React.useMemo((): DataGridStyle => getDataGridTreeIndentStyle(row, indent), [row, indent]);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Expansion must not bubble into the row's onRowClick handler.
			event.stopPropagation();
			row.toggleExpanded();
		},
		[row],
	);
	return (
		<span data-slot="data-grid-table-row-expand" style={indentStyle} className={cn("inline-flex shrink-0 items-center ps-(--data-grid-tree-padding) align-middle", className)}>
			{row.getCanExpand() ? (
				<button
					type="button"
					aria-expanded={isExpanded}
					aria-label={isExpanded ? labels.collapseRow : labels.expandRow}
					onClick={handleClick}
					className={cn(
						"inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
						props.tableLayout.dense ? "size-6" : "size-7",
					)}>
					{children ?? (
						<ChevronDownIcon
							aria-hidden="true"
							className="size-4 in-aria-[expanded=false]:-rotate-90 motion-safe:transition-transform motion-safe:duration-200 rtl:in-aria-[expanded=false]:rotate-90"
						/>
					)}
				</button>
			) : (
				// Leaf spacer: compact, so leaf content sits near the parent label.
				<span aria-hidden="true" className="w-2 shrink-0" />
			)}
		</span>
	);
}

// ── Body rows (state switch) ───────────────────────────────────────────────
