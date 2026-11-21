import { z } from "zod";

import type { SpreadsheetCellsChange, SpreadsheetColumns } from "@workspace/ui/components/spreadsheet";

// The sample the Spreadsheet examples share: the lines of a small budget, schema first with the type derived from
// it. Every example edits the same cells and differs only in the feature it shows.

const budgetLineSchema = z.object({
	id: z.string().min(1),
	item: z.string(),
	category: z.string(),
	quantity: z.number().int().nonnegative(),
	/** In whole dollars. */
	unitPrice: z.number().nonnegative(),
});

export type BudgetLine = z.output<typeof budgetLineSchema>;

export const BUDGET_LINES: readonly BudgetLine[] = budgetLineSchema.array().parse([
	{ id: "b-1", item: "Laptops", category: "Hardware", quantity: 4, unitPrice: 1450 },
	{ id: "b-2", item: "Monitors", category: "Hardware", quantity: 8, unitPrice: 320 },
	{ id: "b-3", item: "Design tool seats", category: "Software", quantity: 6, unitPrice: 144 },
	{ id: "b-4", item: "Cloud hosting", category: "Services", quantity: 12, unitPrice: 210 },
	{ id: "b-5", item: "Security audit", category: "Services", quantity: 1, unitPrice: 5200 },
	{ id: "b-6", item: "Team offsite", category: "Travel", quantity: 1, unitPrice: 3800 },
	{ id: "b-7", item: "Conference tickets", category: "Travel", quantity: 3, unitPrice: 890 },
	{ id: "b-8", item: "Office chairs", category: "Hardware", quantity: 5, unitPrice: 275 },
]);

/** A row's stable id: every write names its cell by row id and column id. */
export function getBudgetLineId(line: BudgetLine): string {
	return line.id;
}

/** Typed or pasted text as a whole quantity, or `undefined` to refuse it. */
export function parseQuantity(raw: string): number | undefined {
	const quantity = Number(raw);
	return raw.trim() !== "" && Number.isInteger(quantity) && quantity >= 0 ? quantity : undefined;
}

/** Typed or pasted text as a price, or `undefined` to refuse it. A leading `$` and thousands commas are accepted. */
export function parsePrice(raw: string): number | undefined {
	const cleaned = raw.trim().replace(/^\$/u, "").replaceAll(",", "");
	const price = Number(cleaned);
	return cleaned !== "" && Number.isFinite(price) && price >= 0 ? price : undefined;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
	return money.format(amount);
}

const NUMERIC_CELL = "text-end tabular-nums";

/**
 * A column is writable when it declares `meta.cellEdit`. `parse` types what was typed, pasted or filled and returns
 * `undefined` to refuse it; `clearValue` is what Delete and cut leave behind. The Total column has no `cellEdit`, so
 * it is read-only and is worked out from the other two.
 */
export const BUDGET_COLUMNS: SpreadsheetColumns<BudgetLine> = [
	{ accessorKey: "item", header: "Item", size: 220, meta: { cellEdit: { control: "text", clearValue: "" } } },
	{ accessorKey: "category", header: "Category", size: 150, meta: { cellEdit: { control: "text", clearValue: "" } } },
	{
		accessorKey: "quantity",
		header: "Quantity",
		size: 110,
		meta: { cellClassName: NUMERIC_CELL, headerClassName: "text-end", cellEdit: { control: "text", parse: parseQuantity, clearValue: 0 } },
	},
	{
		accessorKey: "unitPrice",
		header: "Unit price",
		size: 130,
		cell: ({ row }): string => formatMoney(row.original.unitPrice),
		meta: { cellClassName: NUMERIC_CELL, headerClassName: "text-end", cellEdit: { control: "text", parse: parsePrice, clearValue: 0 } },
	},
	{
		id: "total",
		header: "Total",
		size: 130,
		accessorFn: (line: BudgetLine): number => line.quantity * line.unitPrice,
		cell: ({ row }): string => formatMoney(row.original.quantity * row.original.unitPrice),
		meta: { cellClassName: `${NUMERIC_CELL} text-muted-foreground`, headerClassName: "text-end" },
	},
];

/**
 * The lines with one batch of writes applied. A paste, a fill, a cut or an edit arrives as ONE batch however many
 * cells it covers, so this is one state update. Each written line is checked against the schema.
 */
export function applyBudgetChanges(lines: readonly BudgetLine[], change: SpreadsheetCellsChange<BudgetLine>): readonly BudgetLine[] {
	const written = new Map<string, BudgetLine>();
	for (const { rowId, columnId, value } of change.changes) {
		const current = written.get(rowId) ?? lines.find((line) => line.id === rowId);
		const next = budgetLineSchema.safeParse({ ...current, [columnId]: value });
		if (next.success) {
			written.set(rowId, next.data);
		}
	}
	return lines.map((line) => written.get(line.id) ?? line);
}
