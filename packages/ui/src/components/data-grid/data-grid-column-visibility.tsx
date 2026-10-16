"use client";

// The column-visibility menu: one checkbox item per hideable column, opened
// from a trigger element the consumer supplies. Data-agnostic — it toggles the
// consumer's own table state, and its copy comes from the `dataGrid` labels.

import { getColumnHeaderLabel, useDataGrid, useDataGridAtom, type DataGridColumn, type DataGridCoreTable } from "@workspace/ui/components/data-grid/data-grid";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import type { RowData } from "@tanstack/react-table";
import * as React from "react";

/** The element a `DropdownMenuTrigger` renders as (the consumer's button). */
export type DataGridColumnVisibilityTrigger = NonNullable<React.ComponentProps<typeof DropdownMenuTrigger>["render"]>;

export interface DataGridColumnVisibilityItemProps<TData extends RowData> {
	readonly column: DataGridColumn<TData>;
}

/**
 * One column's visibility checkbox. Subscribes to the visibility slice itself,
 * so the check mark follows the state while the menu stays open.
 */
export function DataGridColumnVisibilityItem<TData extends RowData>({ column }: DataGridColumnVisibilityItemProps<TData>): React.JSX.Element {
	useDataGridAtom(column.table.atoms.columnVisibility);
	const label = getColumnHeaderLabel(column);
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			column.toggleVisibility(checked);
		},
		[column],
	);
	return (
		<DropdownMenuCheckboxItem
			// Title-casing is for a raw column id only; an authored label keeps its own casing.
			className={label === column.id ? "capitalize" : undefined}
			checked={column.getIsVisible()}
			onCheckedChange={handleCheckedChange}>
			{label}
		</DropdownMenuCheckboxItem>
	);
}

export interface DataGridColumnVisibilityProps<TData extends RowData> {
	/** The grid's table (the `useTable` result or any column's `table`). */
	readonly table: DataGridCoreTable<TData>;
	/** The element that opens the menu, e.g. an outline `Button`. */
	readonly trigger: DataGridColumnVisibilityTrigger;
	/** Ref to the rendered trigger element (React 19 ref prop — a generic `forwardRef` would erase `TData`). */
	readonly ref?: React.Ref<HTMLButtonElement>;
}

/** A dropdown listing every hideable column with a visibility checkbox. */
export function DataGridColumnVisibility<TData extends RowData>({ table, trigger, ref }: DataGridColumnVisibilityProps<TData>): React.JSX.Element {
	const { labels } = useDataGrid();
	const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());

	return (
		<DropdownMenu>
			<DropdownMenuTrigger ref={ref} render={trigger} />
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-medium">{labels.toggleColumns}</DropdownMenuLabel>
					{hideableColumns.map((column) => (
						<DataGridColumnVisibilityItem key={column.id} column={column} />
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
