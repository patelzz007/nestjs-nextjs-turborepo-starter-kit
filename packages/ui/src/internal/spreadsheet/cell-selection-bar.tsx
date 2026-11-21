"use client";

// The cell selection's bar (enhancement 8.1: split from cell-selection.tsx): the summary and actions shown while cells are selected.

import { Button } from "@workspace/ui/components/button";
import { type TableEngineGridVisitor, type TableEngineTypedGrid, useTableEngine, useTableEngineAtom } from "../table-engine/table-engine";
import { cn } from "@workspace/ui/lib/core/utils";
import type { RowData } from "@tanstack/react-table";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

export const tableEngineSelectionBarVariants = cva("flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5", {
	variants: {
		/** `floating` (centred, sticky to the bottom of the viewport) or `inline` (in the flow, full width). */
		variant: {
			// The floating toolbar: centred and sticky to the viewport bottom (above pinned cells, like the sticky header).
			floating: "sticky inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[calc(100%-2rem)] shadow-lg",
			inline: "w-full",
		},
	},
	defaultVariants: {
		variant: "floating",
	},
});

export interface TableEngineSelectionBarProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children">, VariantProps<typeof tableEngineSelectionBarVariants> {
	/** The consumer's bulk-action controls. */
	readonly children?: React.ReactNode;
	/** Overrides the `selectionBarCount` label. */
	readonly label?: (count: number) => React.ReactNode;
	/** Overrides the `selectionBarClear` label. */
	readonly clearLabel?: React.ReactNode;
	/** Called after the clear button reset the row selection. */
	readonly onClear?: () => void;
}

export interface TableEngineSelectionBarContentProps<TData extends RowData> extends TableEngineSelectionBarProps {
	readonly grid: TableEngineTypedGrid<TData>;
	readonly barRef: React.ForwardedRef<HTMLDivElement>;
}

export function TableEngineSelectionBarContent<TData extends RowData>({
	grid,
	barRef,
	children,
	className,
	variant,
	label,
	clearLabel,
	onClear,
	...props
}: TableEngineSelectionBarContentProps<TData>): React.JSX.Element | null {
	const { labels } = useTableEngine();
	const { table } = grid;
	const rowSelection = useTableEngineAtom(table.atoms.rowSelection);
	const count = React.useMemo((): number => (Object.keys(rowSelection).length === 0 ? 0 : table.getSelectedRowModel().rows.length), [rowSelection, table]);
	const handleClear = React.useCallback((): void => {
		table.resetRowSelection();
		onClear?.();
	}, [table, onClear]);

	if (count === 0) {
		return null;
	}
	return (
		<div ref={barRef} data-slot="table-engine-selection-bar" className={cn(tableEngineSelectionBarVariants({ variant }), className)} {...props}>
			<span className="text-sm font-medium text-foreground">{label === undefined ? labels.selectionBarCount(count) : label(count)}</span>
			<div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
				{children}
				<Button variant="ghost" size="sm" onClick={handleClear}>
					{clearLabel ?? labels.selectionBarClear}
				</Button>
			</div>
		</div>
	);
}

/**
 * Thin shell over row selection for bulk actions: the selected count, a slot
 * for the consumer's controls, and a clear action. Hidden while nothing is
 * selected; what the controls do stays consumer-owned.
 */
export const TableEngineSelectionBar = React.forwardRef<HTMLDivElement, TableEngineSelectionBarProps>(function TableEngineSelectionBar(props, ref): React.JSX.Element {
	const { withGrid } = useTableEngine();
	const visitor = React.useMemo(
		(): TableEngineGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <TableEngineSelectionBarContent grid={grid} barRef={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
