import { describe, expect, it } from "vitest";

import {
	displayStringFromTanStackValue,
	normalizeFacetedUniqueValues,
	parseDataTableCellValue,
	parseDataTablePersistedPrefs,
	parseDataTablePrefsPatch,
	readDataTableRowField,
	reconcileDataTablePrefs,
	toDataTableCellString,
} from "../prefs";

const PAGE_SIZES: readonly number[] = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

describe("parseDataTablePersistedPrefs", () => {
	it("reads saved preferences", () => {
		const saved = JSON.stringify({ columnVisibility: { email: false }, pageSize: 50, sorting: [{ id: "name", desc: true }], columnPinning: { start: ["name"] } });
		expect(parseDataTablePersistedPrefs(saved)).toEqual({
			columnVisibility: { email: false },
			pageSize: 50,
			sorting: [{ id: "name", desc: true }],
			columnPinning: { start: ["name"] },
		});
	});

	it("is null for broken JSON or the wrong shape", () => {
		expect(parseDataTablePersistedPrefs("{not json")).toBeNull();
		expect(parseDataTablePersistedPrefs(JSON.stringify({ pageSize: -1 }))).toBeNull();
	});
});

describe("parseDataTablePrefsPatch", () => {
	it("keeps a valid patch and refuses an invalid one", () => {
		expect(parseDataTablePrefsPatch({ pageSize: 10 })).toEqual({ pageSize: 10 });
		expect(parseDataTablePrefsPatch({ pageSize: 1.5 })).toBeNull();
	});
});

describe("reconcileDataTablePrefs", () => {
	it("drops columns that no longer exist and keeps a page size that is still offered", () => {
		const reconciled = reconcileDataTablePrefs({
			prefs: {
				columnVisibility: { email: false, gone: false },
				pageSize: 50,
				sorting: [
					{ id: "name", desc: false },
					{ id: "gone", desc: true },
				],
				columnPinning: { start: ["name", "gone"], end: ["gone"] },
				columnOrder: ["email", "gone", "name"],
				columnSizing: { email: 240, gone: 90 },
				density: "compact",
			},
			columnIds: ["name", "email"],
			pageSizeOptions: PAGE_SIZES,
			defaultPageSize: DEFAULT_PAGE_SIZE,
			isServerMode: false,
		});
		expect(reconciled).toEqual({
			columnVisibility: { email: false },
			pageSize: 50,
			sorting: [{ id: "name", desc: false }],
			columnPinning: { start: ["name"], end: [] },
			columnOrder: ["email", "name"],
			columnSizing: { email: 240 },
			density: "compact",
		});
	});

	it("refuses a saved density the table does not know and a column width that is not positive", () => {
		expect(parseDataTablePersistedPrefs(JSON.stringify({ density: "tiny" }))).toBeNull();
		expect(parseDataTablePersistedPrefs(JSON.stringify({ columnSizing: { name: 0 } }))).toBeNull();
	});

	it("uses the defaults with nothing saved, and the first option for a page size no longer offered", () => {
		const input = { columnIds: ["name"], pageSizeOptions: PAGE_SIZES, defaultPageSize: DEFAULT_PAGE_SIZE, isServerMode: false };
		expect(reconcileDataTablePrefs({ ...input, prefs: null })).toEqual({
			columnVisibility: {},
			pageSize: DEFAULT_PAGE_SIZE,
			sorting: [],
			columnPinning: { start: [], end: [] },
			columnOrder: [],
			columnSizing: {},
			density: undefined,
		});
		expect(reconcileDataTablePrefs({ ...input, prefs: { pageSize: 7 } }).pageSize).toBe(10);
	});

	it("ignores a saved sort in server mode, where the parent owns it", () => {
		const reconciled = reconcileDataTablePrefs({
			prefs: { sorting: [{ id: "name", desc: true }] },
			columnIds: ["name"],
			pageSizeOptions: PAGE_SIZES,
			defaultPageSize: DEFAULT_PAGE_SIZE,
			isServerMode: true,
		});
		expect(reconciled.sorting).toEqual([]);
	});
});

describe("cell values", () => {
	it("parses scalars and shallow records, and anything else as empty", () => {
		expect(parseDataTableCellValue("a")).toBe("a");
		expect(parseDataTableCellValue(null)).toBe("");
		expect(parseDataTableCellValue({ city: "Oslo" })).toEqual({ city: "Oslo" });
		expect(parseDataTableCellValue({ nested: { deep: 1 } })).toBe("");
	});

	it("writes scalars as text and records as JSON", () => {
		expect(toDataTableCellString(3)).toBe("3");
		expect(toDataTableCellString(false)).toBe("false");
		expect(toDataTableCellString({ city: "Oslo" })).toBe('{"city":"Oslo"}');
		expect(displayStringFromTanStackValue(undefined)).toBe("");
	});

	it("reads a row's field, empty when it is missing", () => {
		expect(readDataTableRowField({ name: "Ada" }, "name")).toBe("Ada");
		expect(readDataTableRowField({ name: "Ada" }, "email")).toBe("");
	});

	it("reads a field even when ANOTHER field of the row is a list or nested", () => {
		const row = { name: "Design", children: [{ id: "f-1-1", name: "Logos" }], owner: { team: { lead: "Ada" } } };
		expect(readDataTableRowField(row, "name")).toBe("Design");
	});

	it("hands back a list or a nested field as itself, for JSON text", () => {
		const row = { roles: ["admin", "editor"], owner: { team: { lead: "Ada" } } };
		expect(readDataTableRowField(row, "roles")).toEqual(["admin", "editor"]);
		expect(toDataTableCellString(readDataTableRowField(row, "owner"))).toBe('{"team":{"lead":"Ada"}}');
	});
});

describe("normalizeFacetedUniqueValues", () => {
	it("keys a map's counts by their display text", () => {
		const raw = new Map<string | number, number>([
			["paid", 3],
			[2, 1],
		]);
		expect([...normalizeFacetedUniqueValues(raw)]).toEqual([
			["paid", 3],
			["2", 1],
		]);
	});

	it("reads a record of counts, and is empty for nothing", () => {
		expect([...normalizeFacetedUniqueValues({ open: 2 })]).toEqual([["open", 2]]);
		expect(normalizeFacetedUniqueValues(undefined).size).toBe(0);
	});
});
