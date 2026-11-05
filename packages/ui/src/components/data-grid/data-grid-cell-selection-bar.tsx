"use client";

// The cell selection's bar (enhancement 8.1: split from data-grid-cell-selection.tsx): the summary and actions shown while cells are selected.

import { Button } from "@workspace/ui/components/button";
import { type DataGridGridVisitor, type DataGridTypedGrid, useDataGrid, useDataGridAtom } from "@workspace/ui/components/data-grid/data-grid";
import { cn } from "@workspace/ui/lib/core/utils";
import type { RowData } from "@tanstack/react-table";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

export const dataGridSelectionBarVariants = cva("flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5", {
	variants: {
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

export interface DataGridSelectionBarProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children">, VariantProps<typeof dataGridSelectionBarVariants> {
	/** The consumer's bulk-action controls. */
	readonly children?: React.ReactNode;
	/** Overrides the `selectionBarCount` label. */
	readonly label?: (count: number) => React.ReactNode;
	/** Overrides the `selectionBarClear` label. */
	readonly clearLabel?: React.ReactNode;
	/** Called after the clear button reset the row selection. */
	readonly onClear?: () => void;
}

export interface DataGridSelectionBarContentProps<TData extends RowData> extends DataGridSelectionBarProps {
	readonly grid: DataGridTypedGrid<TData>;
	readonly barRef: React.ForwardedRef<HTMLDivElement>;
}

export function DataGridSelectionBarContent<TData extends RowData>({
	grid,
	barRef,
	children,
	className,
	variant,
	label,
	clearLabel,
	onClear,
	...props
}: DataGridSelectionBarContentProps<TData>): React.JSX.Element | null {
	const { labels } = useDataGrid();
	const { table } = grid;
	const rowSelection = useDataGridAtom(table.atoms.rowSelection);
	const count = React.useMemo((): number => (Object.keys(rowSelection).length === 0 ? 0 : table.getSelectedRowModel().rows.length), [rowSelection, table]);
	const handleClear = React.useCallback((): void => {
		table.resetRowSelection();
		onClear?.();
	}, [table, onClear]);

	if (count === 0) {
		return null;
	}
	return (
		<div ref={barRef} data-slot="data-grid-selection-bar" className={cn(dataGridSelectionBarVariants({ variant }), className)} {...props}>
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
export const DataGridSelectionBar = React.forwardRef<HTMLDivElement, DataGridSelectionBarProps>(function DataGridSelectionBar(props, ref): React.JSX.Element {
	const { withGrid } = useDataGrid();
	const visitor = React.useMemo(
		(): DataGridGridVisitor<React.JSX.Element> => ({
			visit: (grid) => <DataGridSelectionBarContent grid={grid} barRef={ref} {...props} />,
		}),
		[props, ref],
	);
	return withGrid(visitor);
});
