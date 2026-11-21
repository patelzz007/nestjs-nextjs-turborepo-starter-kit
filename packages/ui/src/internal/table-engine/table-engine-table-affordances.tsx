"use client";

// The data grid table's states and row affordances (enhancement 8.1: split from table-engine-table.tsx): empty, loading, pin, select and expand.

import { hasGlobalConstructor } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { type TableEngineCoreTable, type TableEngineGridVisitor, useTableEngine } from "./table-engine";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import { type RowData, Subscribe } from "@tanstack/react-table";
import { ChevronDownIcon, PinIcon, PinOffIcon } from "lucide-react";
import * as React from "react";
import {
	DEFAULT_TREE_INDENT_PX,
	type TableEngineRow,
	type TableEngineStyle,
	FILL_COLUMN_SPAN,
	OVERFLOW_TOLERANCE_PX,
	VISIBLE_LEAF_COUNT_VISITOR,
	getTableEngineScrollAreaViewport,
	getTableEngineTreeIndentStyle,
	spacingClassesOf,
} from "./table-engine-table-layout";

/** The empty-state row: `emptyMessage`, else the `empty` label, centred on the visible part of the viewport. */
export const TableEngineTableEmpty = React.forwardRef<HTMLTableRowElement, Omit<React.ComponentProps<"tr">, "children">>(function TableEngineTableEmpty(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps, withGrid } = useTableEngine();
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
		const scrollViewport = getTableEngineScrollAreaViewport(node) ?? node.closest('[data-slot="table-engine-table-viewport"]')?.parentElement ?? null;
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
				<div ref={handleMessageRef} data-slot="table-engine-table-empty" className="sticky start-0">
					{gridProps.emptyMessage ?? labels.empty}
				</div>
			</td>
		</tr>
	);
});

/** A floating loading badge, for grids that overlay their loading state instead of replacing the body. */
export const TableEngineTableLoader = React.forwardRef<HTMLDivElement, Omit<React.ComponentProps<"div">, "children">>(function TableEngineTableLoader(
	{ className, ...props },
	ref,
): React.JSX.Element {
	const { labels, props: gridProps } = useTableEngine();
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

export interface TableEngineTableRowAffordanceProps<TData extends RowData> {
	/** The TanStack Table row instance. */
	readonly row: TableEngineRow<TData>;
}

/** Row pin toggle: pins the row to the top, or unpins it. */
export function TableEngineTableRowPin<TData extends RowData>({ row }: TableEngineTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useTableEngine();
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

export function TableEngineTableRowSelectCheckbox<TData extends RowData>({ row }: TableEngineTableRowAffordanceProps<TData>): React.JSX.Element {
	const { labels } = useTableEngine();
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
export function TableEngineTableRowSelect<TData extends RowData>({ row }: TableEngineTableRowAffordanceProps<TData>): React.JSX.Element {
	return <Subscribe source={row.table.atoms.rowSelection}>{() => <TableEngineTableRowSelectCheckbox row={row} />}</Subscribe>;
}

export function TableEngineTableRowSelectAllCheckbox<TData extends RowData>({ table }: { readonly table: TableEngineCoreTable<TData> }): React.JSX.Element {
	const { labels, recordCount, isLoading } = useTableEngine();
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

export const SELECT_ALL_VISITOR: TableEngineGridVisitor<React.JSX.Element> = {
	visit: (grid) => {
		const { table } = grid;
		return <Subscribe source={table.atoms.rowSelection}>{() => <TableEngineTableRowSelectAllCheckbox table={table} />}</Subscribe>;
	},
};

/** Header select-all checkbox for the current page. */
export function TableEngineTableRowSelectAll(): React.JSX.Element {
	return useTableEngine().withGrid(SELECT_ALL_VISITOR);
}

export interface TableEngineTableRowExpandProps<TData extends RowData> extends TableEngineTableRowAffordanceProps<TData> {
	/** Horizontal offset in px per tree depth level. */
	readonly indent?: number;
	/** Additional CSS classes for the wrapper. */
	readonly className?: string;
	/** Custom toggle icon; replaces the default chevron. */
	readonly children?: React.ReactNode;
}

/** Row expansion toggle with tree indentation (a compact spacer for leaf rows). */
export function TableEngineTableRowExpand<TData extends RowData>({
	row,
	indent = DEFAULT_TREE_INDENT_PX,
	className,
	children,
}: TableEngineTableRowExpandProps<TData>): React.JSX.Element {
	const { labels, props } = useTableEngine();
	const isExpanded = row.getIsExpanded();
	const indentStyle = React.useMemo((): TableEngineStyle => getTableEngineTreeIndentStyle(row, indent), [row, indent]);
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			// Expansion must not bubble into the row's onRowClick handler.
			event.stopPropagation();
			row.toggleExpanded();
		},
		[row],
	);
	return (
		<span
			data-slot="table-engine-table-row-expand"
			style={indentStyle}
			className={cn("inline-flex shrink-0 items-center ps-(--table-engine-tree-padding) align-middle", className)}>
			{row.getCanExpand() ? (
				<button
					type="button"
					aria-expanded={isExpanded}
					aria-label={isExpanded ? labels.collapseRow : labels.expandRow}
					onClick={handleClick}
					className={cn(
						"inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
						spacingClassesOf(props.tableLayout).rowToggle,
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
