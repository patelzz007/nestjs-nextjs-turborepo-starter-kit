import { productListQuery, ProductListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	ALL_FILTER_OPTION,
	eqFilter,
	listStateToListQuery,
	parseBooleanFilterOption,
	parseFilterOption,
	sortParamToTableSorting,
	tableSortingToListSort,
	tableStateToListQuery,
	toListSearch,
} from "./list-query";
import { resolveRequest } from "./endpoints";

const LIST_PATH = "/product";

/** The query string the typed client would send for `input`. */
function resolveRequestQueryForTest(input: ReturnType<typeof tableStateToListQuery>): string {
	return resolveRequest(LIST_PATH, input).url.slice(LIST_PATH.length + 1);
}

const PRODUCT_SORTABLE: readonly ("name" | "price" | "createdAt")[] = ["name", "price", "createdAt"];
const MAX_SORT_TERMS_PLUS_ONE: readonly { readonly id: string; readonly desc: boolean }[] = [
	{ id: "name", desc: false },
	{ id: "price", desc: true },
	{ id: "createdAt", desc: false },
	{ id: "name", desc: true },
];

describe("tableSortingToListSort", () => {
	it("returns undefined for an empty sorting state (resource default)", () => {
		expect(tableSortingToListSort([], PRODUCT_SORTABLE)).toBeUndefined();
	});

	it("maps TanStack sorting to the comma grammar with a - prefix for descending", () => {
		expect(
			tableSortingToListSort(
				[
					{ id: "price", desc: true },
					{ id: "name", desc: false },
				],
				PRODUCT_SORTABLE,
			),
		).toBe("-price,name");
	});

	it("drops columns outside the whitelist instead of producing a 400", () => {
		expect(tableSortingToListSort([{ id: "actions", desc: false }], PRODUCT_SORTABLE)).toBeUndefined();
	});

	it("resolves column aliases to API sort fields", () => {
		expect(tableSortingToListSort([{ id: "productName", desc: true }], PRODUCT_SORTABLE, { productName: "name" })).toBe("-name");
	});

	it("ignores repeated fields and caps the number of sort keys", () => {
		expect(tableSortingToListSort(MAX_SORT_TERMS_PLUS_ONE, PRODUCT_SORTABLE)).toBe("name,-price,createdAt");
	});
});

describe("filter option parsing", () => {
	it("returns undefined for blank and 'all' selections", () => {
		expect(parseFilterOption("", z.enum(["A", "B"]))).toBeUndefined();
		expect(parseFilterOption(ALL_FILTER_OPTION, z.enum(["A", "B"]))).toBeUndefined();
	});

	it("returns the typed value when the schema accepts it, undefined otherwise", () => {
		expect(parseFilterOption(" A ", z.enum(["A", "B"]))).toBe("A");
		expect(parseFilterOption("C", z.enum(["A", "B"]))).toBeUndefined();
	});

	it("parses boolean select values", () => {
		expect(parseBooleanFilterOption("true")).toBe(true);
		expect(parseBooleanFilterOption("false")).toBe(false);
		expect(parseBooleanFilterOption(ALL_FILTER_OPTION)).toBeUndefined();
	});

	it("trims search text and drops blank searches", () => {
		expect(toListSearch("  shoe ")).toBe("shoe");
		expect(toListSearch("   ")).toBeUndefined();
	});

	it("wraps a single value as an eq filter", () => {
		expect(eqFilter(true)).toEqual({ eq: true });
		expect(eqFilter(undefined)).toBeUndefined();
	});
});

describe("tableStateToListQuery", () => {
	it("sends only pagination for the default table state", () => {
		expect(tableStateToListQuery(productListQuery, { pagination: { page: 1, limit: 20 }, sorting: [] })).toEqual({ page: 1, limit: 20 });
	});

	it("keeps the keyset cursor while the default order is in effect", () => {
		const input = tableStateToListQuery(productListQuery, { pagination: { page: 2, limit: 20, cursor: "abc" }, sorting: [{ id: "createdAt", desc: true }] });
		expect(input).toEqual({ page: 2, limit: 20, cursor: "abc" });
	});

	it("drops the cursor for a custom sort so the API pages by offset", () => {
		const input = tableStateToListQuery(productListQuery, { pagination: { page: 2, limit: 20, cursor: "abc" }, sorting: [{ id: "price", desc: false }] });
		expect(input).toEqual({ page: 2, limit: 20, sort: "price" });
	});

	it("includes search and only an active filter", () => {
		expect(
			tableStateToListQuery(productListQuery, {
				pagination: { page: 1, limit: 20 },
				sorting: [],
				search: "  shoe ",
				filter: { isActive: eqFilter(true), brand: undefined },
			}),
		).toEqual({ page: 1, limit: 20, search: "shoe", filter: { isActive: { eq: true }, brand: undefined } });
		expect(tableStateToListQuery(productListQuery, { pagination: { page: 1, limit: 20 }, sorting: [], search: " ", filter: { isActive: undefined } })).toEqual({
			page: 1,
			limit: 20,
		});
	});

	it("produces input the resource's strict list schema accepts and serializes to bracket keys", () => {
		const input = tableStateToListQuery(productListQuery, {
			pagination: { page: 1, limit: 20 },
			sorting: [{ id: "price", desc: true }],
			filter: { isActive: eqFilter(true), price: { gte: 10, lte: 99 } },
		});
		expect(ProductListQuerySchema.safeParse(input).success).toBe(true);
		expect(resolveRequestQueryForTest(input)).toBe(
			"page=1&limit=20&sort=-price&filter%5BisActive%5D%5Beq%5D=true&filter%5Bprice%5D%5Bgte%5D=10&filter%5Bprice%5D%5Blte%5D=99",
		);
	});
});

describe("sortParamToTableSorting", () => {
	it("splits the sort param into table entries without validating them", () => {
		expect(sortParamToTableSorting("-price, name,,-")).toEqual([
			{ id: "price", desc: true },
			{ id: "name", desc: false },
		]);
	});

	it("returns no entries for the default order", () => {
		expect(sortParamToTableSorting(undefined)).toEqual([]);
	});
});

describe("listStateToListQuery", () => {
	it("builds the same input as tableStateToListQuery for the equivalent table state", () => {
		const fromUrl = listStateToListQuery(productListQuery, {
			pagination: { page: 3, limit: 50 },
			sort: "-price,name",
			search: " shoe ",
			filter: { isActive: eqFilter(false) },
		});
		const fromTable = tableStateToListQuery(productListQuery, {
			pagination: { page: 3, limit: 50 },
			sorting: [
				{ id: "price", desc: true },
				{ id: "name", desc: false },
			],
			search: " shoe ",
			filter: { isActive: eqFilter(false) },
		});
		expect(fromUrl).toEqual(fromTable);
		expect(fromUrl).toEqual({ page: 3, limit: 50, sort: "-price,name", search: "shoe", filter: { isActive: { eq: false } } });
	});

	it("re-applies the whitelist, the default order and the cursor rule", () => {
		expect(listStateToListQuery(productListQuery, { pagination: { page: 2, limit: 20, cursor: "abc" }, sort: "-createdAt" })).toEqual({ page: 2, limit: 20, cursor: "abc" });
		expect(listStateToListQuery(productListQuery, { pagination: { page: 2, limit: 20, cursor: "abc" }, sort: "secret,-price" })).toEqual({
			page: 2,
			limit: 20,
			sort: "-price",
		});
	});
});
