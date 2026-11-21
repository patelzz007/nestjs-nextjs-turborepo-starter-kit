import { describe, expect, it } from "vitest";

import {
	formatSpreadsheetCellRef,
	offsetSpreadsheetCellRef,
	parseSpreadsheetCellRef,
	parseSpreadsheetRangeRef,
	spreadsheetColumnIndex,
	spreadsheetColumnLetters,
	spreadsheetRangeCells,
} from "../address";

describe("spreadsheet column letters", () => {
	it("turns indexes into letters and back, across the Z → AA boundary", () => {
		const pairs: readonly (readonly [number, string])[] = [
			[0, "A"],
			[25, "Z"],
			[26, "AA"],
			[51, "AZ"],
			[52, "BA"],
			[701, "ZZ"],
			[702, "AAA"],
		];
		for (const [index, letters] of pairs) {
			expect(spreadsheetColumnLetters(index)).toBe(letters);
			expect(spreadsheetColumnIndex(letters)).toBe(index);
		}
	});

	it("reads lower case, and refuses anything that is not letters", () => {
		expect(spreadsheetColumnIndex("ab")).toBe(27);
		expect(spreadsheetColumnIndex("A1")).toBeNull();
		expect(spreadsheetColumnIndex("")).toBeNull();
	});
});

describe("spreadsheet cell references", () => {
	it("reads and writes a cell reference", () => {
		expect(parseSpreadsheetCellRef("B2")).toEqual({ column: 1, row: 1 });
		expect(parseSpreadsheetCellRef(" aa10 ")).toEqual({ column: 26, row: 9 });
		expect(formatSpreadsheetCellRef({ column: 26, row: 9 })).toBe("AA10");
	});

	it("refuses row zero, a missing row and stray text", () => {
		expect(parseSpreadsheetCellRef("A0")).toBeNull();
		expect(parseSpreadsheetCellRef("A")).toBeNull();
		expect(parseSpreadsheetCellRef("1A")).toBeNull();
		expect(parseSpreadsheetCellRef("A1B")).toBeNull();
	});
});

describe("spreadsheet ranges", () => {
	it("normalises a range whichever corner comes first", () => {
		const expected = { start: { column: 0, row: 0 }, end: { column: 2, row: 3 } };
		expect(parseSpreadsheetRangeRef("A1:C4")).toEqual(expected);
		expect(parseSpreadsheetRangeRef("C4:A1")).toEqual(expected);
	});

	it("treats a single cell as a one-cell range, and refuses broken ranges", () => {
		expect(parseSpreadsheetRangeRef("B2")).toEqual({ start: { column: 1, row: 1 }, end: { column: 1, row: 1 } });
		expect(parseSpreadsheetRangeRef("A1:")).toBeNull();
		expect(parseSpreadsheetRangeRef("A1:B2:C3")).toBeNull();
	});

	it("lists a range's cells row by row", () => {
		const range = parseSpreadsheetRangeRef("A1:B2");
		expect(range === null ? [] : spreadsheetRangeCells(range).map(formatSpreadsheetCellRef)).toEqual(["A1", "B1", "A2", "B2"]);
	});
});

describe("offsetSpreadsheetCellRef", () => {
	it("moves a reference, and refuses to move it off the sheet", () => {
		expect(offsetSpreadsheetCellRef({ column: 1, row: 1 }, 2, 1)).toEqual({ column: 2, row: 3 });
		expect(offsetSpreadsheetCellRef({ column: 0, row: 0 }, -1, 0)).toBeNull();
	});
});
