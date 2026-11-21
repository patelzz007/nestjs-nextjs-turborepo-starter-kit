"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns } from "@workspace/ui/components/data-table";
import { cn } from "@workspace/ui/lib/core/utils";

/** A product's stock position. */
interface StockItem {
	readonly sku: string;
	readonly name: string;
	readonly onHand: number;
	readonly reorderPoint: number;
	readonly daysOfCover: number;
}

export const STOCK: readonly StockItem[] = [
	{ sku: "PAP-A4", name: "A4 paper, 500 sheets", onHand: 340, reorderPoint: 120, daysOfCover: 41 },
	{ sku: "INK-BLK", name: "Black ink cartridge", onHand: 18, reorderPoint: 25, daysOfCover: 6 },
	{ sku: "STP-26", name: "Staples 26/6", onHand: 0, reorderPoint: 40, daysOfCover: 0 },
	{ sku: "PEN-BLU", name: "Ballpoint pen, blue", onHand: 95, reorderPoint: 80, daysOfCover: 14 },
	{ sku: "ENV-C5", name: "C5 envelopes", onHand: 410, reorderPoint: 150, daysOfCover: 58 },
	{ sku: "TAP-CLR", name: "Clear tape", onHand: 31, reorderPoint: 30, daysOfCover: 9 },
];

/** How a stock line looks: one rule list, first match wins. Colours are tokens, never raw values. */
export type StockLevel = "out" | "reorder" | "low" | "healthy";

interface StockRule {
	readonly level: StockLevel;
	readonly matches: (item: StockItem) => boolean;
}

/** The rules in order: the first one that matches decides the level. */
export const STOCK_RULES: readonly StockRule[] = [
	{ level: "out", matches: (item) => item.onHand === 0 },
	{ level: "reorder", matches: (item) => item.onHand <= item.reorderPoint },
	{ level: "low", matches: (item) => item.daysOfCover < LOW_COVER_DAYS },
	{ level: "healthy", matches: (): boolean => true },
];

/** Fewer days of cover than this is low, even above the reorder point. */
const LOW_COVER_DAYS = 15;

/** The level of a stock line by the first rule it meets. */
export function stockLevelOf(item: StockItem): StockLevel {
	return STOCK_RULES.find((rule) => rule.matches(item))?.level ?? "healthy";
}

const LEVEL_STYLE: Readonly<
	Record<StockLevel, { readonly label: string; readonly badge: "destructive-light" | "warning-light" | "info-light" | "success-light"; readonly figure: string }>
> = {
	out: { label: "Out of stock", badge: "destructive-light", figure: "font-semibold text-destructive" },
	reorder: { label: "Reorder now", badge: "warning-light", figure: "font-semibold text-warning-foreground" },
	low: { label: "Running low", badge: "info-light", figure: "text-info-foreground" },
	healthy: { label: "Healthy", badge: "success-light", figure: "text-muted-foreground" },
};

function getSku(item: StockItem): string {
	return item.sku;
}

const COLUMNS: DataTableColumns<StockItem> = [
	{ accessorKey: "name", header: "Product", size: 220 },
	{
		accessorKey: "onHand",
		header: "On hand",
		size: 100,
		// The figure takes the level's emphasis, so the eye lands on the numbers that need action.
		cell: ({ row }): React.JSX.Element => <span className={cn("tabular-nums", LEVEL_STYLE[stockLevelOf(row.original)].figure)}>{row.original.onHand}</span>,
		meta: { cellClassName: "text-end", headerClassName: "text-end [&>div]:justify-end" },
	},
	{ accessorKey: "reorderPoint", header: "Reorder at", size: 110, meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" } },
	{ accessorKey: "daysOfCover", header: "Days of cover", size: 120, meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" } },
	{
		id: "level",
		header: "Status",
		size: 140,
		accessorFn: (item: StockItem): string => stockLevelOf(item),
		cell: ({ row }): React.JSX.Element => {
			const style = LEVEL_STYLE[stockLevelOf(row.original)];
			return <Badge variant={style.badge}>{style.label}</Badge>;
		},
	},
];

/**
 * Recipe: conditional formatting. A small rule list in the recipe decides each line's level (first match wins), and
 * the cells take that level's badge and emphasis. The table has no formatting rules of its own: it draws the cells it
 * is given.
 */
export function DataTableRecipeConditionalFormatting(): React.JSX.Element {
	return <DataTable data={STOCK} columns={COLUMNS} getRowId={getSku} />;
}
