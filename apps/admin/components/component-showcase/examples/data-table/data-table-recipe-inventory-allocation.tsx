"use client";

import type { CellData, RowData } from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

import { DataTable, type DataTableCellEdit, type DataTableColumns, type DataTableDetail, type DataTableEditing } from "@workspace/ui/components/data-table";
import { cn } from "@workspace/ui/lib/core/utils";

const allocationSchema = z.object({
	id: z.string(),
	sku: z.string(),
	warehouse: z.string(),
	onHand: z.number().int().nonnegative(),
	/** Units promised to open orders. */
	allocated: z.number().int().nonnegative(),
	/** Units held back (damage checks, safety stock). */
	reserved: z.number().int().nonnegative(),
});

/** One SKU in one warehouse: what is on the shelf, and how it is spoken for. */
type Allocation = z.output<typeof allocationSchema>;

export const ALLOCATIONS: readonly Allocation[] = [
	{ id: "a-1", sku: "CHAIR-OAK", warehouse: "Shah Alam", onHand: 120, allocated: 84, reserved: 10 },
	{ id: "a-2", sku: "CHAIR-OAK", warehouse: "Penang", onHand: 40, allocated: 34, reserved: 4 },
	{ id: "a-3", sku: "DESK-120", warehouse: "Shah Alam", onHand: 65, allocated: 20, reserved: 5 },
	{ id: "a-4", sku: "LAMP-BRS", warehouse: "Johor Bahru", onHand: 210, allocated: 150, reserved: 0 },
	{ id: "a-5", sku: "SHELF-5T", warehouse: "Penang", onHand: 18, allocated: 0, reserved: 2 },
];

/** What is left to promise: on hand less allocated and reserved. */
export function availableOf(row: Allocation): number {
	return row.onHand - row.allocated - row.reserved;
}

/** Typed text as a whole number of units, or `undefined` to refuse it. */
export function parseUnits(raw: string): number | undefined {
	const units = Number(raw);
	return raw.trim() !== "" && Number.isInteger(units) && units >= 0 ? units : undefined;
}

type Commitment = "allocated" | "reserved";

/**
 * A validator that refuses a figure promising more than the shelf holds. It is given the row as it was before the
 * edit, so it weighs the new figure against the other commitment.
 */
export function commitmentValidator(column: Commitment): (value: CellData, row: RowData) => string | undefined {
	return (value: CellData, row: RowData): string | undefined => {
		const units = z.number().safeParse(value);
		const current = allocationSchema.safeParse(row);
		if (!units.success || !current.success) {
			return undefined;
		}
		const other = column === "allocated" ? current.data.reserved : current.data.allocated;
		const room = current.data.onHand - other;
		return units.data > room ? `At most ${String(room)} can be ${column} here` : undefined;
	};
}

/** Writes an edited figure into its row, keeping the row unchanged when the result would not be a valid allocation. */
export function withAllocationValue(row: Allocation, columnId: string, value: CellData): Allocation {
	const written = allocationSchema.safeParse({ ...row, [columnId]: value });
	return written.success ? written.data : row;
}

/** A row's share of shelf space as a stacked bar: allocated, reserved, then what is free. */
const PERCENT = 100;

function AllocationBar({ row }: { readonly row: Allocation }): React.JSX.Element {
	const share = (units: number): string => `${String(row.onHand === 0 ? 0 : (units / row.onHand) * PERCENT)}%`;
	return (
		<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
			<div className="bg-primary" style={{ width: share(row.allocated) }} />
			<div className="bg-warning" style={{ width: share(row.reserved) }} />
		</div>
	);
}

function renderAllocationDetail(row: Allocation): React.JSX.Element {
	return (
		<div className="grid max-w-md gap-3 text-sm">
			<AllocationBar row={row} />
			<dl className="grid grid-cols-3 gap-2">
				<div>
					<dt className="text-xs text-muted-foreground">Allocated</dt>
					<dd className="font-medium tabular-nums">{row.allocated}</dd>
				</div>
				<div>
					<dt className="text-xs text-muted-foreground">Reserved</dt>
					<dd className="font-medium tabular-nums">{row.reserved}</dd>
				</div>
				<div>
					<dt className="text-xs text-muted-foreground">Free to promise</dt>
					<dd className="font-medium tabular-nums">{availableOf(row)}</dd>
				</div>
			</dl>
		</div>
	);
}

const DETAIL: DataTableDetail<Allocation> = { render: renderAllocationDetail };

/** Fewer free units than this is shown as tight. */
const TIGHT_BELOW = 5;

const NUMBER_META = { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" };

const COLUMNS: DataTableColumns<Allocation> = [
	{ accessorKey: "sku", header: "SKU", size: 130, meta: { cellClassName: "font-mono text-xs" } },
	{ accessorKey: "warehouse", header: "Warehouse", size: 140 },
	{ accessorKey: "onHand", header: "On hand", size: 100, meta: NUMBER_META },
	{ accessorKey: "allocated", header: "Allocated", size: 110, meta: { ...NUMBER_META, cellEdit: { parse: parseUnits, validate: commitmentValidator("allocated") } } },
	{ accessorKey: "reserved", header: "Reserved", size: 110, meta: { ...NUMBER_META, cellEdit: { parse: parseUnits, validate: commitmentValidator("reserved") } } },
	{
		id: "available",
		header: "Free",
		size: 90,
		// A computed column: never edited, recalculated from the row every time the row changes.
		accessorFn: availableOf,
		cell: ({ row }): React.JSX.Element => {
			const free = availableOf(row.original);
			return <span className={cn("font-medium", free < TIGHT_BELOW ? "text-warning-foreground" : "text-success-foreground")}>{free}</span>;
		},
		meta: NUMBER_META,
	},
];

function getAllocationId(row: Allocation): string {
	return row.id;
}

/**
 * Recipe: inventory allocation. Allocated and Reserved are editable; each refuses a figure that would promise more
 * than is on the shelf, with the reason under the editor. Free is computed from the row, and each row opens to a
 * bar of how its stock is spoken for. Undo and Redo walk back through the edits.
 */
export function DataTableRecipeInventoryAllocation(): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly Allocation[]>(ALLOCATIONS);

	const editing = React.useMemo(
		(): DataTableEditing<Allocation> => ({
			onCellEdit: (edit: DataTableCellEdit<Allocation>): void => {
				setRows((current) => current.map((row) => (row.id === edit.rowId ? withAllocationValue(row, edit.columnId, edit.value) : row)));
			},
			history: true,
		}),
		[],
	);

	return <DataTable data={rows} columns={COLUMNS} getRowId={getAllocationId} editing={editing} detail={DETAIL} />;
}
