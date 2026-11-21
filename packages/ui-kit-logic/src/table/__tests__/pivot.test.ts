import { describe, expect, it } from "vitest";

import { aggregateDataTablePivotValues, pivotDataTableRows, type DataTablePivotAggregation, type DataTablePivotSpec } from "../pivot";

interface Sale {
	readonly region: string;
	readonly quarter: string;
	readonly amount: number;
}

const SALES: readonly Sale[] = [
	{ region: "North", quarter: "Q1", amount: 10 },
	{ region: "North", quarter: "Q1", amount: 30 },
	{ region: "North", quarter: "Q2", amount: 5 },
	{ region: "South", quarter: "Q2", amount: 20 },
];

function specFor(aggregation: DataTablePivotAggregation): DataTablePivotSpec<Sale> {
	return { rowKey: (sale) => sale.region, columnKey: (sale) => sale.quarter, value: (sale) => sale.amount, aggregation };
}

describe("aggregateDataTablePivotValues", () => {
	it("combines values five ways", () => {
		const values = [4, 1, 7];
		expect(aggregateDataTablePivotValues(values, "sum")).toBe(12);
		expect(aggregateDataTablePivotValues(values, "count")).toBe(3);
		expect(aggregateDataTablePivotValues(values, "average")).toBe(4);
		expect(aggregateDataTablePivotValues(values, "min")).toBe(1);
		expect(aggregateDataTablePivotValues(values, "max")).toBe(7);
	});

	it("has no value for no values", () => {
		expect(aggregateDataTablePivotValues([], "sum")).toBeNull();
		expect(aggregateDataTablePivotValues([], "count")).toBeNull();
	});
});

describe("pivotDataTableRows", () => {
	it("keeps the keys in the order they were first seen", () => {
		const pivot = pivotDataTableRows(SALES, specFor("sum"));
		expect(pivot.rowKeys).toEqual(["North", "South"]);
		expect(pivot.columnKeys).toEqual(["Q1", "Q2"]);
	});

	it("sums each cell, and leaves an empty cell without a value", () => {
		const pivot = pivotDataTableRows(SALES, specFor("sum"));
		expect(pivot.cell("North", "Q1")).toBe(40);
		expect(pivot.cell("North", "Q2")).toBe(5);
		expect(pivot.cell("South", "Q1")).toBeNull();
		expect(pivot.cell("East", "Q1")).toBeNull();
	});

	it("totals each row, each column and the whole", () => {
		const pivot = pivotDataTableRows(SALES, specFor("sum"));
		expect(pivot.rowTotal("North")).toBe(45);
		expect(pivot.columnTotal("Q2")).toBe(25);
		expect(pivot.grandTotal).toBe(65);
	});

	it("averages totals over the source rows, not over the cells", () => {
		const pivot = pivotDataTableRows(SALES, specFor("average"));
		// North: (10 + 30 + 5) / 3 = 15. An average of its two cells, (20 + 5) / 2, would be 12.5.
		expect(pivot.rowTotal("North")).toBe(15);
		expect(pivot.cell("North", "Q1")).toBe(20);
		expect(pivot.grandTotal).toBe(16.25);
	});

	it("counts rows per cell", () => {
		const pivot = pivotDataTableRows(SALES, specFor("count"));
		expect(pivot.cell("North", "Q1")).toBe(2);
		expect(pivot.grandTotal).toBe(4);
	});

	it("pivots nothing into an empty grid", () => {
		const pivot = pivotDataTableRows([], specFor("sum"));
		expect(pivot.rowKeys).toEqual([]);
		expect(pivot.columnKeys).toEqual([]);
		expect(pivot.grandTotal).toBeNull();
	});
});
