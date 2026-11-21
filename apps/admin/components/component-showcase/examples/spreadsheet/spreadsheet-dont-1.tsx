"use client";

import * as React from "react";
import { z } from "zod";

import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetColumns } from "@workspace/ui/components/spreadsheet";

import { formatMoney, parsePrice, parseQuantity } from "./spreadsheet-sample";

// The total is stored and writable here, so it goes stale the moment Quantity or Unit price changes, and a reader
// can type a total that no longer matches the row.
const storedLineSchema = z.object({
	id: z.string().min(1),
	item: z.string(),
	quantity: z.number().int().nonnegative(),
	unitPrice: z.number().nonnegative(),
	total: z.number().nonnegative(),
});

type StoredLine = z.output<typeof storedLineSchema>;

const LINES: readonly StoredLine[] = storedLineSchema.array().parse([
	{ id: "b-1", item: "Laptops", quantity: 4, unitPrice: 1450, total: 5800 },
	{ id: "b-2", item: "Monitors", quantity: 8, unitPrice: 320, total: 2560 },
	{ id: "b-3", item: "Design tool seats", quantity: 6, unitPrice: 144, total: 864 },
]);

function getLineId(line: StoredLine): string {
	return line.id;
}

const NUMERIC_CELL = "text-end tabular-nums";

const COLUMNS: SpreadsheetColumns<StoredLine> = [
	{ accessorKey: "item", header: "Item", size: 220, meta: { cellEdit: { control: "text", clearValue: "" } } },
	{ accessorKey: "quantity", header: "Quantity", size: 110, meta: { cellClassName: NUMERIC_CELL, cellEdit: { control: "text", parse: parseQuantity, clearValue: 0 } } },
	{
		accessorKey: "unitPrice",
		header: "Unit price",
		size: 130,
		cell: ({ row }): string => formatMoney(row.original.unitPrice),
		meta: { cellClassName: NUMERIC_CELL, cellEdit: { control: "text", parse: parsePrice, clearValue: 0 } },
	},
	{
		accessorKey: "total",
		header: "Total",
		size: 130,
		cell: ({ row }): string => formatMoney(row.original.total),
		meta: { cellClassName: NUMERIC_CELL, cellEdit: { control: "text", parse: parsePrice, clearValue: 0 } },
	},
];

function applyChanges(lines: readonly StoredLine[], change: SpreadsheetCellsChange<StoredLine>): readonly StoredLine[] {
	const written = new Map<string, StoredLine>();
	for (const { rowId, columnId, value } of change.changes) {
		const current = written.get(rowId) ?? lines.find((line) => line.id === rowId);
		const next = storedLineSchema.safeParse({ ...current, [columnId]: value });
		if (next.success) {
			written.set(rowId, next.data);
		}
	}
	return lines.map((line) => written.get(line.id) ?? line);
}

export function SpreadsheetDont1Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly StoredLine[]>(LINES);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<StoredLine>): void => {
		setLines((current) => applyChanges(current, change));
	}, []);

	return <Spreadsheet data={lines} columns={COLUMNS} getRowId={getLineId} onCellsChange={handleCellsChange} />;
}
