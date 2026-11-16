import { useTable, type ColumnDef, type ColumnPinningState, type ColumnVisibilityState } from "@tanstack/react-table";
import { renderHook } from "@testing-library/react-native";

import {
	clampDataGridColumnSize,
	dataGridCellsChange,
	dataGridCellText,
	dataGridColumnLabel,
	dataGridColumnWindow,
	dataGridCopyDetails,
	dataGridDisplayColumns,
	dataGridDropIndex,
	dataGridFeatures,
	dataGridMovedColumnOrder,
	dataGridValueText,
	DEFAULT_DATA_GRID_LABELS,
	DEFAULT_DATA_GRID_LAYOUT,
	isDataGridCellWritable,
	moveDataGridColumn,
	resolveDataGridLayout,
	type DataGridFeatures,
	type DataGridTableInstance,
} from "../data-grid";

interface Item {
	readonly id: string;
	readonly name: string;
	readonly qty: number;
	readonly locked: boolean;
}

const ITEMS: readonly Item[] = [
	{ id: "a", name: "Apple", qty: 3, locked: false },
	{ id: "b", name: "Banana", qty: 5, locked: true },
	{ id: "c", name: "Cherry", qty: 7, locked: false },
];

const COLUMNS: ColumnDef<DataGridFeatures, Item>[] = [
	{ accessorKey: "name", header: "Name", meta: { cellEdit: { format: (value): string => `<${String(value)}>`, parse: (raw: string): string => raw.trim() } } },
	{
		accessorKey: "qty",
		header: (): string => "Quantity",
		meta: {
			headerTitle: "Qty",
			cellEdit: {
				editable: (row: Item): boolean => !row.locked,
				parse: (raw: string): number | undefined => (Number.isFinite(Number(raw)) && raw !== "" ? Number(raw) : undefined),
				clearValue: 0,
			},
		},
	},
	{ id: "id", accessorFn: (row: Item): string => row.id, header: (): string => "Code" },
	{ accessorKey: "locked", header: "Locked", meta: { cellEdit: { editable: false } } },
];

async function tableOf(
	options: { readonly pinning?: ColumnPinningState; readonly visibility?: ColumnVisibilityState; readonly order?: string[] } = {},
): Promise<DataGridTableInstance<Item>> {
	const { result } = await renderHook(() =>
		useTable({
			features: dataGridFeatures,
			columns: COLUMNS,
			data: ITEMS,
			getRowId: (row: Item): string => row.id,
			initialState: { columnPinning: options.pinning ?? { start: [], end: [] }, columnVisibility: options.visibility ?? {}, columnOrder: options.order ?? [] },
		}),
	);
	return result.current;
}

/** The first row and column through the third row and second column (Name and Qty, Apple to Cherry). */
const BLOCK = { minRowIndex: 0, maxRowIndex: 2, minColumnIndex: 0, maxColumnIndex: 1 };

describe("the native data grid's defaults", () => {
	it("speak English, with the phone's own control words", () => {
		expect(DEFAULT_DATA_GRID_LABELS.paginationInfo({ from: 1, to: 5, count: 9 })).toBe("1 - 5 of 9");
		expect(DEFAULT_DATA_GRID_LABELS.fillDown).toBe("Fill down");
		expect(DEFAULT_DATA_GRID_LABELS.columnOptions("Name")).toBe("Name column options");
	});

	it("resolve every layout flag: the caller's, else the default", () => {
		expect(resolveDataGridLayout()).toEqual(DEFAULT_DATA_GRID_LAYOUT);
		const layout = resolveDataGridLayout({ dense: true, rowBorder: false, width: "auto", cellSelection: true });
		expect(layout).toMatchObject({ dense: true, rowBorder: false, width: "auto", cellSelection: true, headerBorder: true });
	});
});

describe("columns", () => {
	it("are named by their title, a plain-text header, or their id", async () => {
		const table = await tableOf();
		const [name, qty, id] = table.getAllLeafColumns();
		expect(name === undefined ? "" : dataGridColumnLabel(name)).toBe("Name");
		expect(qty === undefined ? "" : dataGridColumnLabel(qty)).toBe("Qty");
		expect(id === undefined ? "" : dataGridColumnLabel(id)).toBe("id");
	});

	it("are drawn pinned-start first and pinned-end last, hidden ones left out", async () => {
		const table = await tableOf({ pinning: { start: ["qty"], end: ["name"] }, visibility: { locked: false } });
		expect(dataGridDisplayColumns(table).map((column) => column.id)).toEqual(["qty", "id", "name"]);
	});

	it("move a place either way, clamped at the ends, and stay put when unknown", () => {
		expect(moveDataGridColumn(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
		expect(moveDataGridColumn(["a", "b", "c"], "c", -5)).toEqual(["c", "a", "b"]);
		expect(moveDataGridColumn(["a", "b", "c"], "z", 1)).toEqual(["a", "b", "c"]);
	});

	it("move among the scrolling columns in the table's full order, or not at all at an edge", async () => {
		const table = await tableOf({ pinning: { start: ["name"], end: [] }, order: ["qty"] });
		expect(dataGridMovedColumnOrder(table, "qty", 1)).toEqual(["name", "id", "qty", "locked"]);
		expect(dataGridMovedColumnOrder(table, "qty", -1)).toBeNull();
		expect(dataGridMovedColumnOrder(table, "name", 1)).toBeNull();
		expect(dataGridMovedColumnOrder(table, "locked", 3)).toBeNull();
	});
});

describe("geometry", () => {
	it("drops a dragged column past each neighbour whose half it crossed", () => {
		const widths = [100, 80, 120, 60];
		expect(dataGridDropIndex(widths, 1, 30)).toBe(1);
		expect(dataGridDropIndex(widths, 1, 70)).toBe(2);
		expect(dataGridDropIndex(widths, 1, 500)).toBe(3);
		expect(dataGridDropIndex(widths, 2, -45)).toBe(1);
		expect(dataGridDropIndex(widths, 2, -500)).toBe(0);
		expect(dataGridDropIndex(widths, 2, -20)).toBe(2);
	});

	it("keeps a width within its bounds, in whole points", () => {
		expect(clampDataGridColumnSize(10, 48, 300)).toBe(48);
		expect(clampDataGridColumnSize(512.6, 48, 300)).toBe(300);
		expect(clampDataGridColumnSize(120.4, 48, 300)).toBe(120);
	});

	it("windows the columns in view, with overscan and the widths left out", () => {
		const widths = [100, 100, 100, 100, 100, 100];
		expect(dataGridColumnWindow(widths, 0, 150, 0)).toEqual({ start: 0, end: 1, before: 0, after: 400 });
		expect(dataGridColumnWindow(widths, 250, 100, 1)).toEqual({ start: 1, end: 4, before: 100, after: 100 });
		expect(dataGridColumnWindow(widths, 900, 100, 0)).toEqual({ start: 5, end: 5, before: 500, after: 0 });
		expect(dataGridColumnWindow([], 0, 100, 2)).toEqual({ start: 0, end: -1, before: 0, after: 0 });
	});
});

describe("cell values", () => {
	it("read as text: scalars, dates as ISO, nothing as empty, the rest as JSON", () => {
		expect(dataGridValueText(null)).toBe("");
		expect(dataGridValueText(undefined)).toBe("");
		expect(dataGridValueText("x")).toBe("x");
		expect(dataGridValueText(4)).toBe("4");
		expect(dataGridValueText(false)).toBe("false");
		expect(dataGridValueText(BigInt(9))).toBe("9");
		expect(dataGridValueText(new Date(Date.UTC(2026, 0, 2)))).toBe("2026-01-02T00:00:00.000Z");
		expect(dataGridValueText({ a: 1 })).toBe('{"a":1}');
	});

	it("are writable only where the column says so, per row", async () => {
		const table = await tableOf();
		const [apple, banana] = table.getRowModel().rows;
		const [name, qty, id, locked] = table.getAllLeafColumns();
		if (apple === undefined || banana === undefined || name === undefined || qty === undefined || id === undefined || locked === undefined) {
			throw new Error("The sample table has three rows and four columns.");
		}
		expect(isDataGridCellWritable(name, apple)).toBe(true);
		expect(isDataGridCellWritable(qty, apple)).toBe(true);
		expect(isDataGridCellWritable(qty, banana)).toBe(false);
		expect(isDataGridCellWritable(id, apple)).toBe(false);
		expect(isDataGridCellWritable(locked, apple)).toBe(false);
		expect(dataGridCellText(name, apple)).toBe("<Apple>");
		expect(dataGridCellText(qty, apple)).toBe("3");
	});
});

describe("the spreadsheet operations", () => {
	it("copy a block as TSV, each cell as its column formats it", async () => {
		expect(dataGridCopyDetails(await tableOf(), BLOCK)).toEqual({ text: "<Apple>\t3\r\n<Banana>\t5\r\n<Cherry>\t7", rowCount: 3, columnCount: 2 });
	});

	it("parse pasted text per column, refusing locked rows and values a column cannot read", async () => {
		const details = dataGridCellsChange(
			await tableOf(),
			BLOCK,
			[
				[" Avocado ", "9"],
				["Blueberry", "4"],
				["Cranberry", "many"],
			],
			"paste",
		);
		expect(details.source).toBe("paste");
		expect(details.changes.map((change) => [change.rowId, change.columnId, change.previousValue, change.value])).toEqual([
			["a", "name", "Apple", "Avocado"],
			["a", "qty", 3, 9],
			["b", "name", "Banana", "Blueberry"],
			["c", "name", "Cherry", "Cranberry"],
		]);
		expect(details.rejected).toEqual([
			{ rowId: "b", columnId: "qty" },
			{ rowId: "c", columnId: "qty" },
		]);
	});

	it("clear to each column's clear value, refuse columns without an edit contract, and pass text through without a parser", async () => {
		const table = await tableOf();
		const cleared = dataGridCellsChange(table, { minRowIndex: 0, maxRowIndex: 0, minColumnIndex: 0, maxColumnIndex: 2 }, [], "clear");
		expect(cleared.changes.map((change) => change.value)).toEqual([null, 0]);
		expect(cleared.rejected).toEqual([{ rowId: "a", columnId: "id" }]);

		const { result } = await renderHook(() =>
			useTable({
				features: dataGridFeatures,
				columns: [{ accessorKey: "name", header: "Name", meta: { cellEdit: {} } }],
				data: ITEMS,
				getRowId: (row: Item): string => row.id,
			}),
		);
		const raw = dataGridCellsChange(result.current, { minRowIndex: 1, maxRowIndex: 1, minColumnIndex: 0, maxColumnIndex: 0 }, [], "edit");
		expect(raw.changes.map((change) => change.value)).toEqual([""]);
	});
});
