"use client";

import * as React from "react";
import { z } from "zod";

import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import {
	DataTable,
	pivotDataTableRows,
	type DataTableColumns,
	type DataTableFooter,
	type DataTableHeading,
	type DataTablePivot,
	type DataTablePivotAggregation,
} from "@workspace/ui/components/data-table";

import { NUMERIC_COLUMN_META } from "./data-table-sample";

/** One order line: where it was sold, in which quarter, and for how much. */
interface Sale {
	readonly id: string;
	readonly region: string;
	readonly quarter: string;
	readonly amount: number;
}

const REGIONS: readonly string[] = ["North", "South", "East", "West"];
const QUARTERS: readonly string[] = ["Q1", "Q2", "Q3", "Q4"];
/** Sample figures: three order lines per region and quarter, each a little bigger than the last, so every cell differs. */
const LINES_PER_CELL = 3;
const BASE_AMOUNT = 400;
const REGION_STEP = 70;
const QUARTER_STEP = 45;
const LINE_STEP = 15;

export const SALES: readonly Sale[] = REGIONS.flatMap((region, regionIndex) =>
	QUARTERS.flatMap((quarter, quarterIndex) =>
		Array.from({ length: LINES_PER_CELL }, (_line, line): Sale => ({
			id: `${region}-${quarter}-${String(line)}`,
			region,
			quarter,
			amount: BASE_AMOUNT + regionIndex * REGION_STEP + quarterIndex * QUARTER_STEP + line * LINE_STEP,
		})),
	),
);

const aggregationSchema = z.enum(["sum", "average", "count", "max"]);
/** The total column's title for every aggregation the helper knows; the toggle offers four of them. */
const AGGREGATION_LABELS: Readonly<Record<DataTablePivotAggregation, string>> = { sum: "Total", average: "Average", count: "Orders", min: "Smallest", max: "Largest" };

/** One row of the pivoted grid: a region, with a figure per quarter and its own total. */
interface PivotRow {
	readonly region: string;
}

function getPivotRowId(row: PivotRow): string {
	return row.region;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

/** A figure as text: money for amounts, a plain number for a count, and a dash for a cell no order fell into. */
export function formatPivotFigure(value: number | null, aggregation: DataTablePivotAggregation): string {
	if (value === null) {
		return "–";
	}
	return aggregation === "count" ? count.format(value) : money.format(value);
}

/** The grid as DataTable columns: the region, one column per quarter, and the row's total. */
export function pivotColumns(pivot: DataTablePivot, aggregation: DataTablePivotAggregation): DataTableColumns<PivotRow> {
	return [
		{ accessorKey: "region", header: "Region", size: 140 },
		...pivot.columnKeys.map((quarter): DataTableColumns<PivotRow>[number] => ({
			id: quarter,
			header: quarter,
			size: 120,
			accessorFn: (row: PivotRow): number => pivot.cell(row.region, quarter) ?? 0,
			cell: ({ row }): string => formatPivotFigure(pivot.cell(row.original.region, quarter), aggregation),
			meta: NUMERIC_COLUMN_META,
		})),
		{
			id: "total",
			header: AGGREGATION_LABELS[aggregation],
			size: 130,
			accessorFn: (row: PivotRow): number => pivot.rowTotal(row.region) ?? 0,
			cell: ({ row }): React.JSX.Element => <span className="font-medium">{formatPivotFigure(pivot.rowTotal(row.original.region), aggregation)}</span>,
			meta: NUMERIC_COLUMN_META,
		},
	];
}

/** The column totals and the grand total, as the table's footer row. */
export function pivotFooter(pivot: DataTablePivot, aggregation: DataTablePivotAggregation): DataTableFooter {
	const cells: Record<string, React.ReactNode> = { region: <span className="font-medium">All regions</span> };
	for (const quarter of pivot.columnKeys) {
		cells[quarter] = formatPivotFigure(pivot.columnTotal(quarter), aggregation);
	}
	cells.total = <span className="font-medium">{formatPivotFigure(pivot.grandTotal, aggregation)}</span>;
	return { rows: [{ key: "totals", cells }] };
}

/**
 * A pivot is a transform of the data, so DataTable has no pivot prop: `pivotDataTableRows` turns the order lines into
 * a grid of regions by quarters, and the example hands that to the table as rows, columns and a footer. Switch the
 * figure to see every cell, row total and column total recomputed from the order lines.
 */
export function DataTable31Example(): React.JSX.Element {
	const [aggregation, setAggregation] = React.useState<z.output<typeof aggregationSchema>>("sum");

	const pivot = React.useMemo(
		(): DataTablePivot => pivotDataTableRows(SALES, { rowKey: (sale) => sale.region, columnKey: (sale) => sale.quarter, value: (sale) => sale.amount, aggregation }),
		[aggregation],
	);
	const rows = React.useMemo((): readonly PivotRow[] => pivot.rowKeys.map((region) => ({ region })), [pivot]);
	const columns = React.useMemo((): DataTableColumns<PivotRow> => pivotColumns(pivot, aggregation), [pivot, aggregation]);
	const footer = React.useMemo((): DataTableFooter => pivotFooter(pivot, aggregation), [pivot, aggregation]);

	const handleAggregationChange = React.useCallback((values: string[]): void => {
		const next = aggregationSchema.safeParse(values.at(0));
		if (next.success) {
			setAggregation(next.data);
		}
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Sales by region and quarter",
			description: `${count.format(SALES.length)} order lines, pivoted`,
			actions: (
				<ToggleGroup variant="outline" size="sm" value={[aggregation]} onValueChange={handleAggregationChange} aria-label="Figure">
					{aggregationSchema.options.map((option) => (
						<ToggleGroupItem key={option} value={option}>
							{AGGREGATION_LABELS[option]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		}),
		[aggregation, handleAggregationChange],
	);

	return <DataTable data={rows} columns={columns} getRowId={getPivotRowId} heading={heading} footer={footer} />;
}
