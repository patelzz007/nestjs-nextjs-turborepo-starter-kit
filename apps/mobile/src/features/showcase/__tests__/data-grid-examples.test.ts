import type { DataGridCellsChangeDetails } from "@workspace/ui-native/lib/data-grid";

import { moveRow } from "../examples/data-grid/data-grid-14";
import { applyProductChanges } from "../examples/data-grid/data-grid-31";
import { countStatuses, filterEmployees } from "../examples/data-grid/data-grid-crud";
import {
	answerServerRequest,
	EMPLOYEES,
	employeeAt,
	FEED_TOTAL,
	feedPage,
	fetchServerPage,
	formatUsd,
	metricValue,
	ORDERS,
	orderTotal,
	ORG_TREE,
	parseCount,
	PRODUCT_SHEET,
	productStatus,
	SERVER_LATENCY_MS,
	summarize,
	treeChildren,
	type Product,
} from "../examples/data-grid/data-grid-sample-records";

describe("the DataGrid examples' records", () => {
	it("generate the same employees every run, statuses in turn", () => {
		expect(employeeAt(0)).toEqual(employeeAt(0));
		expect(EMPLOYEES.map((employee) => employee.status).slice(0, 5)).toEqual(["Active", "Inactive", "Pending", "Blocked", "Active"]);
		expect(new Set(EMPLOYEES.map((employee) => employee.id)).size).toBe(EMPLOYEES.length);
		expect(employeeAt(0).email).toMatch(/^[a-z]+\.[a-z]+@example\.com$/u);
	});

	it("summarise numbers, and nothing as zeros", () => {
		expect(summarize([2, 4, 9])).toEqual({ sum: 15, min: 2, max: 9, average: 5 });
		expect(summarize([])).toEqual({ sum: 0, min: 0, max: 0, average: 0 });
		expect(formatUsd(1234.5)).toBe("$1,234.50");
	});

	it("total an order's line items", () => {
		const [order] = ORDERS;
		if (order === undefined) {
			throw new Error("There are sample orders.");
		}
		expect(orderTotal(order)).toBeCloseTo(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
		expect(order.items.length).toBeGreaterThanOrEqual(2);
	});

	it("nest departments, teams and members", () => {
		const [department] = ORG_TREE;
		const [team] = department === undefined ? [] : (treeChildren(department) ?? []);
		const [member] = team === undefined ? [] : (treeChildren(team) ?? []);
		expect(department?.kind).toBe("department");
		expect(team?.kind).toBe("team");
		expect(member?.kind).toBe("member");
		expect(member === undefined ? "missing" : treeChildren(member)).toBeUndefined();
	});

	it("read stock as a status and a cell's text as a count", () => {
		expect(productStatus(0)).toBe("Sold out");
		expect(productStatus(4)).toBe("Low stock");
		expect(productStatus(40)).toBe("In stock");
		expect(parseCount(" 1,200 ")).toBe(1200);
		expect(parseCount("")).toBeUndefined();
		expect(parseCount("many")).toBeUndefined();
	});

	it("page a feed until there is no more", () => {
		expect(feedPage(0, 15).next).toBe(15);
		const last = feedPage(FEED_TOTAL - 5, 15);
		expect(last.rows).toHaveLength(5);
		expect(last.next).toBeNull();
		expect(feedPage(FEED_TOTAL, 15).rows).toEqual([]);
	});

	it("fill the matrix with stable figures under a thousand", () => {
		expect(metricValue(3, 7)).toBe(metricValue(3, 7));
		expect(metricValue(999, 35)).toBeLessThan(1000);
	});
});

describe("the simulated server", () => {
	it("searches, filters by status, sorts either way and pages", () => {
		const all = answerServerRequest({ pageIndex: 0, pageSize: 5, sorting: [], search: "", status: null });
		expect(all.rows).toHaveLength(5);
		expect(all.total).toBe(48);
		const blocked = answerServerRequest({ pageIndex: 0, pageSize: 100, sorting: [{ id: "balance", desc: true }], search: "", status: "Blocked" });
		expect(blocked.rows.every((row) => row.status === "Blocked")).toBe(true);
		expect(blocked.rows.map((row) => row.balance)).toEqual([...blocked.rows.map((row) => row.balance)].sort((a, b) => b - a));
		const byName = answerServerRequest({ pageIndex: 1, pageSize: 3, sorting: [{ id: "name", desc: false }], search: "", status: null });
		expect(byName.rows.map((row) => row.name)).toEqual([...byName.rows.map((row) => row.name)].sort((a, b) => a.localeCompare(b)));
		const [first] = EMPLOYEES;
		const found = answerServerRequest({ pageIndex: 0, pageSize: 50, sorting: [{ id: "unknown", desc: false }], search: first?.email ?? "", status: null }, EMPLOYEES);
		expect(found.rows.map((row) => row.id)).toEqual([first?.id]);
		expect(answerServerRequest({ pageIndex: 0, pageSize: 5, sorting: [{ id: "role", desc: false }], search: "zzz", status: null }).total).toBe(0);
	});

	it("answers after its latency", async () => {
		jest.useFakeTimers();
		const answer = fetchServerPage({ pageIndex: 0, pageSize: 2, sorting: [], search: "", status: null });
		jest.advanceTimersByTime(SERVER_LATENCY_MS);
		await expect(answer).resolves.toEqual(expect.objectContaining({ total: 48 }));
		jest.useRealTimers();
	});
});

describe("the DataGrid examples' helpers", () => {
	it("move a dragged row to its new place, and leave the rows alone for a move from nowhere", () => {
		expect(moveRow(["a", "b", "c"], { rowId: "a", from: 0, to: 2 })).toEqual(["b", "c", "a"]);
		expect(moveRow(["a", "b"], { rowId: "z", from: 5, to: 0 })).toEqual(["a", "b"]);
	});

	it("filter the admin list by search and status, and count each status", () => {
		const [first] = EMPLOYEES;
		expect(filterEmployees(EMPLOYEES, first?.name.toUpperCase() ?? "", []).map((row) => row.id)).toContain(first?.id);
		expect(filterEmployees(EMPLOYEES, "", ["Blocked"]).every((row) => row.status === "Blocked")).toBe(true);
		expect(filterEmployees(EMPLOYEES, "@example.com", []).length).toBe(EMPLOYEES.length);
		const counts = countStatuses(EMPLOYEES);
		expect(counts.Active + counts.Inactive + counts.Pending + counts.Blocked).toBe(EMPLOYEES.length);
	});

	it("write a product's changed cells, moving its status with its stock", () => {
		const [product] = PRODUCT_SHEET;
		if (product === undefined) {
			throw new Error("There are sample products.");
		}
		const details: DataGridCellsChangeDetails<Product> = {
			source: "paste",
			rejected: [],
			changes: [
				{ rowId: product.id, columnId: "name", row: product, previousValue: product.name, value: "Renamed" },
				{ rowId: product.id, columnId: "stock", row: product, previousValue: product.stock, value: 2 },
				{ rowId: product.id, columnId: "price", row: product, previousValue: product.price, value: "12.5" },
				{ rowId: "other", columnId: "name", row: product, previousValue: "", value: "Ignored" },
			],
		};
		expect(applyProductChanges(product, details)).toEqual({ ...product, name: "Renamed", stock: 2, status: "Low stock", price: 12.5 });
		const cleared: DataGridCellsChangeDetails<Product> = {
			source: "clear",
			rejected: [],
			changes: [{ rowId: product.id, columnId: "stock", row: product, previousValue: product.stock, value: null }],
		};
		expect(applyProductChanges(product, cleared)).toEqual(expect.objectContaining({ stock: 0, status: "Sold out" }));
	});
});
