import { describe, expect, it } from "vitest";

import {
	createDataTableQuery,
	getDataTablePageRange,
	isDataTableQueryFiltered,
	isEmptyDataTableFilterValue,
	setDataTableFilterValue,
	withDataTableFilter,
	withDataTableFiltersCleared,
	withDataTablePage,
	withDataTablePageSize,
	withDataTableSearch,
	withDataTableSorting,
	type DataTableQuery,
} from "../query";

const PAGE_SIZE = 20;
const THIRD_PAGE_INDEX = 2;

function thirdPage(): DataTableQuery {
	return { ...createDataTableQuery(PAGE_SIZE), pageIndex: THIRD_PAGE_INDEX };
}

describe("createDataTableQuery", () => {
	it("starts on the first page with nothing set", () => {
		expect(createDataTableQuery(PAGE_SIZE)).toEqual({ pageIndex: 0, pageSize: PAGE_SIZE, sorting: [], filters: {}, search: "" });
	});
});

describe("isEmptyDataTableFilterValue", () => {
	it("treats null, undefined, an empty choice, an empty list and an open range as empty", () => {
		expect(isEmptyDataTableFilterValue(null)).toBe(true);
		expect(isEmptyDataTableFilterValue(undefined)).toBe(true);
		expect(isEmptyDataTableFilterValue("")).toBe(true);
		expect(isEmptyDataTableFilterValue([])).toBe(true);
		expect(isEmptyDataTableFilterValue({ from: null, to: null })).toBe(true);
	});

	it("treats a choice, a list with a value and a range with one bound as set", () => {
		expect(isEmptyDataTableFilterValue("paid")).toBe(false);
		expect(isEmptyDataTableFilterValue(["paid"])).toBe(false);
		expect(isEmptyDataTableFilterValue({ from: "2026-11-01", to: null })).toBe(false);
		expect(isEmptyDataTableFilterValue({ from: null, to: "2026-11-30" })).toBe(false);
	});
});

describe("setDataTableFilterValue", () => {
	it("sets a column and keeps the others", () => {
		expect(setDataTableFilterValue({ status: "paid" }, "type", ["a", "b"])).toEqual({ status: "paid", type: ["a", "b"] });
	});

	it("replaces a column's value", () => {
		expect(setDataTableFilterValue({ status: "paid" }, "status", "void")).toEqual({ status: "void" });
	});

	it("removes a column when the value filters nothing", () => {
		expect(setDataTableFilterValue({ status: "paid", type: "x" }, "status", null)).toEqual({ type: "x" });
		expect(setDataTableFilterValue({ status: "paid" }, "status", "")).toEqual({});
		expect(setDataTableFilterValue({ type: ["a"] }, "type", [])).toEqual({});
	});

	it("does not mutate the filters it was given", () => {
		const filters = { status: "paid" };
		setDataTableFilterValue(filters, "status", null);
		expect(filters).toEqual({ status: "paid" });
	});
});

describe("isDataTableQueryFiltered", () => {
	it("is false for a plain query", () => {
		expect(isDataTableQueryFiltered(createDataTableQuery(PAGE_SIZE))).toBe(false);
	});

	it("is true with a search or a set filter", () => {
		expect(isDataTableQueryFiltered({ ...createDataTableQuery(PAGE_SIZE), search: "acme" })).toBe(true);
		expect(isDataTableQueryFiltered({ ...createDataTableQuery(PAGE_SIZE), filters: { status: "paid" } })).toBe(true);
	});

	it("ignores a filter entry that filters nothing", () => {
		expect(isDataTableQueryFiltered({ ...createDataTableQuery(PAGE_SIZE), filters: { type: [] } })).toBe(false);
	});
});

describe("query transitions", () => {
	it("moves to a page, never below the first", () => {
		expect(withDataTablePage(thirdPage(), 4).pageIndex).toBe(4);
		expect(withDataTablePage(thirdPage(), -1).pageIndex).toBe(0);
	});

	it("returns to the first page when the page size changes", () => {
		expect(withDataTablePageSize(thirdPage(), 50)).toMatchObject({ pageIndex: 0, pageSize: 50 });
	});

	it("returns to the first page when the sort changes", () => {
		expect(withDataTableSorting(thirdPage(), [{ id: "name", desc: true }])).toMatchObject({ pageIndex: 0, sorting: [{ id: "name", desc: true }] });
	});

	it("returns to the first page when the search changes", () => {
		expect(withDataTableSearch(thirdPage(), "acme")).toMatchObject({ pageIndex: 0, search: "acme" });
	});

	it("returns to the first page when a filter changes", () => {
		expect(withDataTableFilter(thirdPage(), "status", "paid")).toMatchObject({ pageIndex: 0, filters: { status: "paid" } });
	});

	it("clears the search and every filter, and returns to the first page", () => {
		const filtered: DataTableQuery = { ...thirdPage(), search: "acme", filters: { status: "paid" }, sorting: [{ id: "name", desc: false }] };
		expect(withDataTableFiltersCleared(filtered)).toEqual({ pageIndex: 0, pageSize: PAGE_SIZE, sorting: [{ id: "name", desc: false }], filters: {}, search: "" });
	});
});

describe("getDataTablePageRange", () => {
	it("gives the rows of a full page", () => {
		expect(getDataTablePageRange(0, 10, 42)).toEqual({ from: 1, to: 10, pageCount: 5 });
		expect(getDataTablePageRange(1, 10, 42)).toEqual({ from: 11, to: 20, pageCount: 5 });
	});

	it("stops the last page at the total", () => {
		expect(getDataTablePageRange(4, 10, 42)).toEqual({ from: 41, to: 42, pageCount: 5 });
	});

	it("shows 0 to 0 on one page for an empty table", () => {
		expect(getDataTablePageRange(0, 10, 0)).toEqual({ from: 0, to: 0, pageCount: 1 });
	});

	it("never divides by a page size below one", () => {
		expect(getDataTablePageRange(0, 0, 3)).toEqual({ from: 1, to: 1, pageCount: 3 });
	});
});
