"use client";

import * as React from "react";
import { z } from "zod";

import { Spreadsheet, type SpreadsheetCellsChange, type SpreadsheetColumns, type SpreadsheetFillHandle } from "@workspace/ui/components/spreadsheet";

/** One line of a quote. Every cell may hold a value or a formula (text starting with `=`). */
const quoteLineSchema = z.object({
	id: z.string().min(1),
	item: z.string(),
	quantity: z.union([z.number(), z.string()]),
	unitPrice: z.union([z.number(), z.string()]),
	total: z.union([z.number(), z.string()]),
});

type QuoteLine = z.output<typeof quoteLineSchema>;

// Column A is the item, B the quantity, C the unit price, D the total. Each total multiplies its own row's B and C;
// the last row adds the totals up and works out the tax.
export const QUOTE_LINES: readonly QuoteLine[] = quoteLineSchema.array().parse([
	{ id: "q-1", item: "Laptops", quantity: 4, unitPrice: 1450, total: "=B1*C1" },
	{ id: "q-2", item: "Monitors", quantity: 8, unitPrice: 320, total: "=B2*C2" },
	{ id: "q-3", item: "Docking stations", quantity: 4, unitPrice: 210, total: "=B3*C3" },
	{ id: "q-4", item: "Cables", quantity: 12, unitPrice: 15, total: "" },
	{ id: "q-5", item: "Subtotal", quantity: "=SUM(B1:B4)", unitPrice: "", total: "=SUM(D1:D4)" },
	{ id: "q-6", item: "Tax (6%)", quantity: "", unitPrice: "", total: "=ROUND(D5*0.06, 2)" },
	{ id: "q-7", item: "Grand total", quantity: "", unitPrice: "", total: "=D5+D6" },
]);

function getQuoteLineId(line: QuoteLine): string {
	return line.id;
}

const COLUMNS: SpreadsheetColumns<QuoteLine> = [
	{ accessorKey: "item", header: "Item", size: 200, meta: { cellEdit: { control: "text" } } },
	{ accessorKey: "quantity", header: "Quantity", size: 120, meta: { cellClassName: "text-end tabular-nums", cellEdit: { control: "text" } } },
	{ accessorKey: "unitPrice", header: "Unit price", size: 120, meta: { cellClassName: "text-end tabular-nums", cellEdit: { control: "text" } } },
	{ accessorKey: "total", header: "Total", size: 140, meta: { cellClassName: "text-end tabular-nums font-medium", cellEdit: { control: "text" } } },
];

const FILL_HANDLE: SpreadsheetFillHandle = { variant: "square" };

/** The quote with one batch of writes applied. Each written line is checked against the schema. */
export function applyQuoteChanges(lines: readonly QuoteLine[], change: SpreadsheetCellsChange<QuoteLine>): readonly QuoteLine[] {
	const written = new Map<string, QuoteLine>();
	for (const { rowId, columnId, value } of change.changes) {
		const current = written.get(rowId) ?? lines.find((line) => line.id === rowId);
		const next = quoteLineSchema.safeParse({ ...current, [columnId]: value });
		if (next.success) {
			written.set(rowId, next.data);
		}
	}
	return lines.map((line) => written.get(line.id) ?? line);
}

/**
 * A quote worked out with formulas. Cells are addressed A1-style: the bar above the grid shows the focused cell's
 * address and its formula. The Cables total is empty: select D3 and drag the fill handle down one row, and the formula
 * moves its references to `=B4*C4`. Change a quantity and every total that depends on it follows.
 */
export function Spreadsheet5Example(): React.JSX.Element {
	const [lines, setLines] = React.useState<readonly QuoteLine[]>(QUOTE_LINES);

	const handleCellsChange = React.useCallback((change: SpreadsheetCellsChange<QuoteLine>): void => {
		setLines((current) => applyQuoteChanges(current, change));
	}, []);

	return <Spreadsheet data={lines} columns={COLUMNS} getRowId={getQuoteLineId} onCellsChange={handleCellsChange} formulas headers="a1" fillHandle={FILL_HANDLE} />;
}
