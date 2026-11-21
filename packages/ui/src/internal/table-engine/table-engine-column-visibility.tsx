"use client";

// The column-visibility menu: one checkbox item per hideable column, opened
// from a trigger element the consumer supplies. Data-agnostic — it toggles the
// consumer's own table state, and its copy comes from the `tableEngine` labels.

import { getColumnHeaderLabel, useTableEngine, useTableEngineAtom, type TableEngineColumn, type TableEngineCoreTable } from "./table-engine";
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
export type TableEngineColumnVisibilityTrigger = NonNullable<React.ComponentProps<typeof DropdownMenuTrigger>["render"]>;

export interface TableEngineColumnVisibilityItemProps<TData extends RowData> {
	/** The column this menu item shows or hides. */
	readonly column: TableEngineColumn<TData>;
}

/**
 * One column's visibility checkbox. Subscribes to the visibility slice itself,
 * so the check mark follows the state while the menu stays open.
 */
export function TableEngineColumnVisibilityItem<TData extends RowData>({ column }: TableEngineColumnVisibilityItemProps<TData>): React.JSX.Element {
	useTableEngineAtom(column.table.atoms.columnVisibility);
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

export interface TableEngineColumnVisibilityProps<TData extends RowData> {
	/** The grid's table (the `useTable` result or any column's `table`). */
	readonly table: TableEngineCoreTable<TData>;
	/** The element that opens the menu, e.g. an outline `Button`. */
	readonly trigger: TableEngineColumnVisibilityTrigger;
	/** Ref to the rendered trigger element (React 19 ref prop — a generic `forwardRef` would erase `TData`). */
	readonly ref?: React.Ref<HTMLButtonElement>;
}

/** A dropdown listing every hideable column with a visibility checkbox. */
export function TableEngineColumnVisibility<TData extends RowData>({ table, trigger, ref }: TableEngineColumnVisibilityProps<TData>): React.JSX.Element {
	const { labels } = useTableEngine();
	const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());

	return (
		<DropdownMenu>
			<DropdownMenuTrigger ref={ref} render={trigger} />
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-medium">{labels.toggleColumns}</DropdownMenuLabel>
					{hideableColumns.map((column) => (
						<TableEngineColumnVisibilityItem key={column.id} column={column} />
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
