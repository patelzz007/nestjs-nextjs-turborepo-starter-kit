import { describe, expect, it, vi } from "vitest";

import { buildReadOnlyTableBulk, buildResourceTableBulk, toTableStatus } from "../capabilities";

interface Product {
	readonly id: string;
	readonly name: string;
	readonly sku: string;
}

describe("toTableStatus", () => {
	it("shows skeleton rows on the first load, dimmed rows on a refetch, and nothing once loaded", () => {
		expect(toTableStatus({ isLoading: true })).toEqual({ loading: "initial" });
		expect(toTableStatus({ isLoading: false, isFetching: true })).toEqual({ loading: "refreshing" });
		expect(toTableStatus({ isLoading: false, isFetching: false })).toEqual({ loading: false });
	});

	it("carries an error, and leaves a null one out", () => {
		expect(toTableStatus({ isLoading: false }, "Couldn't load")).toEqual({ loading: false, error: "Couldn't load" });
		expect(toTableStatus({ isLoading: false }, null)).toEqual({ loading: false });
	});
});

describe("buildResourceTableBulk", () => {
	it("exports the row keys asked for, in their order", () => {
		const bulk = buildResourceTableBulk<Product>({ canDelete: false, exportFilename: "products.csv", exportKeys: ["sku", "name"] });
		expect(bulk.exporting).toEqual({ filename: "products.csv", keys: ["sku", "name"] });
	});

	it("exports every column when no keys are given", () => {
		expect(buildResourceTableBulk<Product>({ canDelete: false, exportFilename: "products.csv" }).exporting).toEqual({ filename: "products.csv" });
	});

	it("offers bulk delete only when the session may delete", () => {
		const onDelete = vi.fn();
		expect(buildResourceTableBulk<Product>({ canDelete: true, exportFilename: "p.csv", onDelete }).selection.onDelete).toBe(onDelete);
		expect(buildResourceTableBulk<Product>({ canDelete: false, exportFilename: "p.csv", onDelete }).selection.onDelete).toBeUndefined();
	});
});

describe("buildReadOnlyTableBulk", () => {
	it("gives checkboxes with no bulk action, and the export over the keys asked for", () => {
		expect(buildReadOnlyTableBulk<Product>("products.csv", ["name"])).toEqual({ selection: {}, exporting: { filename: "products.csv", keys: ["name"] } });
		expect(buildReadOnlyTableBulk<Product>("products.csv").exporting).toEqual({ filename: "products.csv" });
	});
});
