"use client";

// The column header a column def renders (`header: ({ column }) =>
// <DataGridColumnHeader column={column} title="Email" />`): a plain label, a
// sort button, or — once the grid enables pinning, moving or visibility — a
// menu with sort, pin, move and column-visibility sections. The `aria-sort`
// state itself lives on the `<th>` (DataGridTable); this part only names and
// drives it.

import { Button } from "@workspace/ui/components/button";
import { DataGridColumnVisibilityItem } from "@workspace/ui/components/data-grid/data-grid-column-visibility";
import { getColumnHeaderLabel, getDataGridHeaderSpans, useDataGrid, useDataGridAtom, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/core/utils";
import type { CellData, Column, RowData } from "@tanstack/react-table";
import { cva, type VariantProps } from "class-variance-authority";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowLeftToLineIcon,
	ArrowRightIcon,
	ArrowRightToLineIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	PinOffIcon,
	Settings2Icon,
} from "lucide-react";
import * as React from "react";

export const dataGridColumnHeaderVariants = cva("flex h-full items-center", {
	variants: {
		variant: {
			/** Not sortable, no menu: static text. */
			label: "gap-1.5 text-sm font-normal text-secondary-foreground/80 [&_svg]:size-3.5 [&_svg]:opacity-60",
			/** A sort button or a menu trigger. */
			control: "-ms-2 justify-between gap-1.5",
		},
	},
	defaultVariants: { variant: "label" },
});

const HEADER_BUTTON_CLASS_NAME =
	"h-6 rounded-md px-2 font-normal text-secondary-foreground/80 hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground";

export interface DataGridColumnHeaderProps<TData extends RowData, TValue extends CellData>
	extends Omit<React.ComponentProps<"div">, "title" | "ref">, Omit<VariantProps<typeof dataGridColumnHeaderVariants>, "variant"> {
	readonly column: Column<DataGridFeatures, TData, TValue>;
	/** Defaults to `meta.headerTitle`, then a string `columnDef.header`, then `column.id`. */
	readonly title?: string;
	readonly icon?: React.ReactNode;
	/** Rendered as the menu's first section (e.g. a `DataGridColumnFilter`). */
	readonly filter?: React.ReactNode;
	/** Adds the column-visibility submenu (with `tableLayout.columnsVisibility`). */
	readonly visibility?: boolean;
	/** Ref to the header's root element (React 19 ref prop — a generic `forwardRef` would erase `TData`). */
	readonly ref?: React.Ref<HTMLDivElement>;
}

/** What a move would do: the leaves that move together and the rendered neighbours on each side. */
export interface DataGridColumnMoveTargets {
	readonly moving: readonly string[];
	readonly before: readonly string[] | undefined;
	readonly after: readonly string[] | undefined;
}

/**
 * Move neighbours come from what is RENDERED: the column's own pin family,
 * visible leaves only, so a click never trades places with a hidden or pinned
 * column. A peer is a sibling at the column's header level together with its
 * leaves and the leaves its `meta.headerColSpan` covers, so groups and spans
 * move as one; a group column itself does not move.
 */
export function getDataGridColumnMoveTargets<TData extends RowData, TValue extends CellData>(column: Column<DataGridFeatures, TData, TValue>): DataGridColumnMoveTargets {
	const { table } = column;
	const isPinned = column.getIsPinned();
	const familyLeaves = isPinned === "start" ? table.getStartVisibleLeafColumns() : isPinned === "end" ? table.getEndVisibleLeafColumns() : table.getCenterVisibleLeafColumns();
	const renderedOrder = new Map(familyLeaves.map((leafColumn, index) => [leafColumn.id, index]));
	const byRenderedOrder = (left: string, right: string): number => (renderedOrder.get(left) ?? 0) - (renderedOrder.get(right) ?? 0);
	const headerSpans = getDataGridHeaderSpans(table);
	const coveredIds = new Set([...headerSpans.values()].flat().map((leafColumn) => leafColumn.id));
	const siblings = column.parent?.columns ?? table.getAllColumns();
	const peers = siblings
		.filter((sibling) => !coveredIds.has(sibling.id))
		.map((sibling) =>
			[...sibling.getLeafColumns(), ...(headerSpans.get(sibling.id) ?? [])]
				.map((leafColumn) => leafColumn.id)
				.filter((id) => renderedOrder.has(id))
				.sort(byRenderedOrder),
		)
		.filter((leaves) => leaves.length > 0)
		.sort(([leftFirst = ""], [rightFirst = ""]) => byRenderedOrder(leftFirst, rightFirst));
	const index = column.columns.length > 0 ? -1 : peers.findIndex(([first]) => first === column.id);
	return {
		moving: peers.at(index) ?? [column.id],
		before: index > 0 ? peers.at(index - 1) : undefined,
		after: index !== -1 && index < peers.length - 1 ? peers.at(index + 1) : undefined,
	};
}

/**
 * The column order after re-seating `moving` before / after `neighbour`. The
 * base is the consumer's `columnOrder` completed with every leaf it leaves out
 * (in definition order — the completion TanStack applies when rendering), so
 * every other column keeps its place.
 */
export function moveDataGridColumns(
	columnOrder: readonly string[],
	definitionOrder: readonly string[],
	moving: readonly string[],
	neighbour: readonly string[],
	side: "before" | "after",
): string[] | null {
	const fullOrder = [...columnOrder, ...definitionOrder.filter((id) => !columnOrder.includes(id))];
	const remaining = fullOrder.filter((id) => !moving.includes(id));
	const anchor = side === "before" ? neighbour.at(0) : neighbour.at(-1);
	const at = anchor === undefined ? -1 : remaining.indexOf(anchor);
	if (at === -1) {
		return null;
	}
	const insertAt = side === "before" ? at : at + 1;
	return [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)];
}

// Unpinning moves a column into another header list, which remounts its
// header, so the focus request outlives the button: the next header rendered
// for that column takes it. `column` keeps its identity across renders.
const pendingUnpinFocus = new WeakSet();

interface MenuCheckProps {
	readonly checked: boolean;
}

function MenuCheck({ checked }: MenuCheckProps): React.JSX.Element | null {
	return checked ? <CheckIcon aria-hidden="true" className="size-4 text-primary" /> : null;
}

function SortIcon({ sorted }: { readonly sorted: false | "asc" | "desc" }): React.JSX.Element {
	if (sorted === "desc") {
		return <ArrowDownIcon aria-hidden="true" className="size-3.5" />;
	}
	if (sorted === "asc") {
		return <ArrowUpIcon aria-hidden="true" className="size-3.5" />;
	}
	return <ChevronsUpDownIcon aria-hidden="true" className="mt-px size-3.5" />;
}

/** A column header: label, sort button, or a sort/pin/move/visibility menu, per the grid's layout flags. */
export function DataGridColumnHeader<TData extends RowData, TValue extends CellData>({
	column,
	title,
	icon,
	className,
	filter,
	visibility = false,
	ref,
	...props
}: DataGridColumnHeaderProps<TData, TValue>): React.JSX.Element {
	const { labels, isLoading, props: gridProps } = useDataGrid();
	const { tableLayout } = gridProps;
	const { table } = column;
	// Sort/pin/order/visibility reach this header through builder calls on a
	// column that keeps its identity; subscribing makes them real dependencies.
	useDataGridAtom(table.atoms.sorting);
	useDataGridAtom(table.atoms.columnPinning);
	useDataGridAtom(table.atoms.columnVisibility);
	const columnOrder = useDataGridAtom(table.atoms.columnOrder);

	const resolvedTitle = title ?? getColumnHeaderLabel(column);
	const isSorted = column.getIsSorted();
	const isPinned = column.getIsPinned();
	const canSort = column.getCanSort();
	const canPin = column.getCanPin();
	const canResize = column.getCanResize();
	const menuTriggerRef = React.useRef<HTMLButtonElement | null>(null);
	React.useLayoutEffect((): void => {
		if (pendingUnpinFocus.delete(column)) {
			menuTriggerRef.current?.focus();
		}
	});

	const moveTargets = getDataGridColumnMoveTargets(column);
	const definitionOrder = table
		.getAllColumns()
		.flatMap((topColumn) => topColumn.getLeafColumns())
		.map((leafColumn) => leafColumn.id);

	const moveBeside = React.useCallback(
		(neighbour: readonly string[] | undefined, side: "before" | "after"): void => {
			if (neighbour === undefined) {
				return;
			}
			const next = moveDataGridColumns(columnOrder, definitionOrder, moveTargets.moving, neighbour, side);
			if (next !== null) {
				table.setColumnOrder(next);
			}
		},
		[columnOrder, definitionOrder, moveTargets.moving, table],
	);

	// column.toggleSorting has no getCanSort() guard of its own.
	const handleSort = React.useCallback((): void => {
		if (!canSort) {
			return;
		}
		if (isSorted === "asc") {
			column.toggleSorting(true);
		} else if (isSorted === "desc") {
			column.clearSorting();
		} else {
			column.toggleSorting(false);
		}
	}, [canSort, column, isSorted]);
	const handleSortAscending = React.useCallback((): void => {
		if (isSorted === "asc") {
			column.clearSorting();
		} else {
			column.toggleSorting(false);
		}
	}, [column, isSorted]);
	const handleSortDescending = React.useCallback((): void => {
		if (isSorted === "desc") {
			column.clearSorting();
		} else {
			column.toggleSorting(true);
		}
	}, [column, isSorted]);
	const handlePinStart = React.useCallback((): void => {
		column.pin(isPinned === "start" ? false : "start");
	}, [column, isPinned]);
	const handlePinEnd = React.useCallback((): void => {
		column.pin(isPinned === "end" ? false : "end");
	}, [column, isPinned]);
	const handleMoveStart = React.useCallback((): void => {
		moveBeside(moveTargets.before, "before");
	}, [moveBeside, moveTargets.before]);
	const handleMoveEnd = React.useCallback((): void => {
		moveBeside(moveTargets.after, "after");
	}, [moveBeside, moveTargets.after]);
	const handleUnpin = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const scrollArea = event.currentTarget.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
			pendingUnpinFocus.add(column);
			column.pin(false);
			// A column the virtual window leaves unmounted claims nothing, so the
			// grid's scroll area takes focus instead of the page.
			requestAnimationFrame((): void => {
				if (pendingUnpinFocus.delete(column)) {
					scrollArea?.focus();
				}
			});
		},
		[column],
	);

	const showPin = tableLayout.columnsPinnable && canPin;
	const showVisibility = tableLayout.columnsVisibility && visibility;
	const hasControls = tableLayout.columnsMovable || showVisibility || showPin || filter !== undefined;
	// A start-pinned column's resize handle covers the end of its cell, so the
	// unpin button steps in to clear it — unless nothing follows its group.
	const unpinClearsResizeHandle =
		tableLayout.columnsResizable &&
		canResize &&
		isPinned === "start" &&
		!(column.getIsLastColumn("start") && table.getCenterVisibleLeafColumns().length === 0 && table.getEndVisibleLeafColumns().length === 0);

	const buttonContent = (
		<>
			{icon}
			{resolvedTitle}
			{canSort ? <SortIcon sorted={isSorted} /> : null}
		</>
	);

	if (hasControls) {
		const sections: React.ReactNode[] = [];
		if (filter !== undefined) {
			sections.push(
				<DropdownMenuGroup key="filter">
					<DropdownMenuLabel>{filter}</DropdownMenuLabel>
				</DropdownMenuGroup>,
			);
		}
		if (canSort) {
			sections.push(
				<DropdownMenuGroup key="sort">
					<DropdownMenuItem onClick={handleSortAscending}>
						<ArrowUpIcon aria-hidden="true" className="size-3.5" />
						<span className="grow">{labels.sortAscending}</span>
						<MenuCheck checked={isSorted === "asc"} />
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleSortDescending}>
						<ArrowDownIcon aria-hidden="true" className="size-3.5" />
						<span className="grow">{labels.sortDescending}</span>
						<MenuCheck checked={isSorted === "desc"} />
					</DropdownMenuItem>
				</DropdownMenuGroup>,
			);
		}
		if (showPin) {
			sections.push(
				<DropdownMenuGroup key="pin">
					<DropdownMenuItem onClick={handlePinStart}>
						<ArrowLeftToLineIcon aria-hidden="true" className="size-3.5" />
						<span className="grow">{labels.pinColumnStart}</span>
						<MenuCheck checked={isPinned === "start"} />
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handlePinEnd}>
						<ArrowRightToLineIcon aria-hidden="true" className="size-3.5" />
						<span className="grow">{labels.pinColumnEnd}</span>
						<MenuCheck checked={isPinned === "end"} />
					</DropdownMenuItem>
				</DropdownMenuGroup>,
			);
		}
		if (tableLayout.columnsMovable) {
			sections.push(
				<DropdownMenuGroup key="move">
					<DropdownMenuItem onClick={handleMoveStart} disabled={moveTargets.before === undefined || isPinned !== false}>
						<ArrowLeftIcon aria-hidden="true" className="size-3.5" />
						<span>{labels.moveColumnStart}</span>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleMoveEnd} disabled={moveTargets.after === undefined || isPinned !== false}>
						<ArrowRightIcon aria-hidden="true" className="size-3.5" />
						<span>{labels.moveColumnEnd}</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>,
			);
		}
		if (showVisibility) {
			sections.push(
				<DropdownMenuSub key="visibility">
					<DropdownMenuSubTrigger>
						<Settings2Icon aria-hidden="true" className="size-3.5" />
						<span>{labels.columnsMenu}</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						{table
							.getAllColumns()
							.filter((candidate) => candidate.getCanHide())
							.map((candidate) => (
								<DataGridColumnVisibilityItem key={candidate.id} column={candidate} />
							))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>,
			);
		}

		return (
			<div ref={ref} data-slot="data-grid-column-header" className={cn(dataGridColumnHeaderVariants({ variant: "control" }), className)} {...props}>
				<DropdownMenu>
					<DropdownMenuTrigger
						ref={menuTriggerRef}
						render={
							<Button variant="ghost" size="sm" className={HEADER_BUTTON_CLASS_NAME} disabled={isLoading}>
								{buttonContent}
							</Button>
						}
					/>
					<DropdownMenuContent className="w-44" align="start">
						{sections.map((section, index) => (
							<React.Fragment key={`section-${String(index)}`}>
								{index > 0 ? <DropdownMenuSeparator /> : null}
								{section}
							</React.Fragment>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				{showPin && isPinned !== false ? (
					<span className={cn("-me-1 flex min-w-7 shrink-[999]", unpinClearsResizeHandle ? "pe-4" : undefined)}>
						<Button
							size="icon-xs"
							variant="ghost"
							className="rounded-md"
							onClick={handleUnpin}
							aria-label={labels.unpinColumn(resolvedTitle)}
							title={labels.unpinColumn(resolvedTitle)}>
							<PinOffIcon aria-hidden="true" className="size-3.5 opacity-50" />
						</Button>
					</span>
				) : null}
			</div>
		);
	}

	if (canSort || (tableLayout.columnsResizable && canResize)) {
		return (
			<div ref={ref} data-slot="data-grid-column-header" className={cn(dataGridColumnHeaderVariants({ variant: "control" }), className)} {...props}>
				<Button variant="ghost" size="sm" className={HEADER_BUTTON_CLASS_NAME} disabled={isLoading} onClick={handleSort}>
					{buttonContent}
				</Button>
			</div>
		);
	}

	return (
		<div ref={ref} data-slot="data-grid-column-header" className={cn(dataGridColumnHeaderVariants({ variant: "label" }), className)} {...props}>
			{icon}
			{resolvedTitle}
		</div>
	);
}
