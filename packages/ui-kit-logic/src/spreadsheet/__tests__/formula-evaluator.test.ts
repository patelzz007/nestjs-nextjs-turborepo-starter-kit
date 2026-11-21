import { describe, expect, it } from "vitest";

import { formatSpreadsheetCellRef, parseSpreadsheetCellRef, type SpreadsheetCellRef } from "../address";
import { createSpreadsheetEvaluator, formatSpreadsheetValue, spreadsheetLiteralValue, type SpreadsheetCellInput } from "../formula-evaluator";

/** A sheet as a map from A1 address to what the cell holds. */
function sheet(cells: Readonly<Record<string, SpreadsheetCellInput>>): (address: string) => string {
	const evaluator = createSpreadsheetEvaluator((ref: SpreadsheetCellRef) => cells[formatSpreadsheetCellRef(ref)] ?? null);
	return (address: string): string => {
		const ref = parseSpreadsheetCellRef(address);
		if (ref === null) {
			throw new Error(`${address} is a cell reference`);
		}
		return formatSpreadsheetValue(evaluator.valueOf(ref));
	};
}

/** Works out one formula on its own sheet, with A1 = 4, A2 = 6, A3 = "x" and A4 empty. */
function evaluate(formula: string): string {
	return sheet({ A1: 4, A2: 6, A3: "x", B1: formula })("B1");
}

describe("spreadsheet literal values", () => {
	it("keeps numbers, reads numeric text as a number, and treats empty text as empty", () => {
		expect(spreadsheetLiteralValue(3)).toEqual({ kind: "number", value: 3 });
		expect(spreadsheetLiteralValue(" 2.5 ")).toEqual({ kind: "number", value: 2.5 });
		expect(spreadsheetLiteralValue("apples")).toEqual({ kind: "string", value: "apples" });
		expect(spreadsheetLiteralValue(true)).toEqual({ kind: "boolean", value: true });
		expect(spreadsheetLiteralValue("")).toEqual({ kind: "empty" });
		expect(spreadsheetLiteralValue(null)).toEqual({ kind: "empty" });
	});
});

describe("spreadsheet formulas", () => {
	it("works out arithmetic with the usual precedence, over other cells", () => {
		expect(evaluate("=A1+A2*2")).toBe("16");
		expect(evaluate("=(A1+A2)/2")).toBe("5");
		expect(evaluate("=2^3^2")).toBe("512");
		expect(evaluate("=-A1")).toBe("-4");
		expect(evaluate("=A4+1")).toBe("1");
	});

	it("joins text and compares values", () => {
		expect(evaluate('=A3&"-"&A1')).toBe("x-4");
		expect(evaluate("=A1<A2")).toBe("TRUE");
		expect(evaluate('=A3="X"')).toBe("TRUE");
		expect(evaluate("=A1<>4")).toBe("FALSE");
		// A number sorts before text, as spreadsheets order mixed values.
		expect(evaluate('=1<"a"')).toBe("TRUE");
	});

	it("shows an error code when a value cannot be worked out", () => {
		expect(evaluate("=A1/0")).toBe("#DIV/0!");
		expect(evaluate("=A3*2")).toBe("#VALUE!");
		expect(evaluate("=price*2")).toBe("#NAME?");
		expect(evaluate("=NOPE(1)")).toBe("#NAME?");
		expect(evaluate("=1+")).toBe("#ERROR!");
		expect(evaluate("=#REF!+1")).toBe("#REF!");
		expect(evaluate("=A1:A2")).toBe("#VALUE!");
	});

	it("lets an error flow through every formula that reads it", () => {
		const read = sheet({ A1: "=1/0", A2: "=A1+1", A3: "=SUM(A1:A2)" });
		expect(read("A2")).toBe("#DIV/0!");
		expect(read("A3")).toBe("#DIV/0!");
	});
});

describe("spreadsheet functions", () => {
	it("aggregates a range, skipping its text and empty cells", () => {
		expect(evaluate("=SUM(A1:A4)")).toBe("10");
		expect(evaluate("=AVERAGE(A1:A4)")).toBe("5");
		expect(evaluate("=MIN(A1:A4, 1)")).toBe("1");
		expect(evaluate("=MAX(A1:A4)")).toBe("6");
		expect(evaluate("=COUNT(A1:A4)")).toBe("2");
	});

	it("refuses text given directly to an aggregate, and averages nothing as #DIV/0!", () => {
		expect(evaluate('=SUM(1, "x")')).toBe("#VALUE!");
		expect(evaluate('=SUM(1, "2")')).toBe("3");
		expect(evaluate("=AVERAGE(A3:A4)")).toBe("#DIV/0!");
		expect(evaluate("=MAX(A3:A4)")).toBe("0");
	});

	it("chooses with IF, defaulting to FALSE without an else", () => {
		expect(evaluate('=IF(A1>3, "big", "small")')).toBe("big");
		expect(evaluate('=IF(A1>5, "big", "small")')).toBe("small");
		expect(evaluate('=IF(A1>5, "big")')).toBe("FALSE");
		expect(evaluate("=IF(A3, 1, 2)")).toBe("#VALUE!");
	});

	it("rounds, takes the absolute value and joins text", () => {
		expect(evaluate("=ROUND(2.345, 2)")).toBe("2.35");
		expect(evaluate("=ROUND(-2.5)")).toBe("-3");
		expect(evaluate("=ROUND(1234, -2)")).toBe("1200");
		expect(evaluate("=ABS(-A1)")).toBe("4");
		expect(evaluate('=CONCAT(A3, "y", A1:A2)')).toBe("xy46");
	});

	it("combines conditions with AND, OR and NOT", () => {
		expect(evaluate("=AND(A1>1, A2>1)")).toBe("TRUE");
		expect(evaluate("=OR(A1>5, A2>5)")).toBe("TRUE");
		expect(evaluate("=NOT(A1>5)")).toBe("TRUE");
		expect(evaluate("=AND(A3:A4)")).toBe("#VALUE!");
	});
});

describe("spreadsheet values across kinds", () => {
	it("coerces booleans, numeric text and empty cells in arithmetic, and refuses other text", () => {
		expect(evaluate("=TRUE+1")).toBe("2");
		expect(evaluate("=FALSE*5")).toBe("0");
		expect(evaluate('="3"+1')).toBe("4");
		expect(evaluate('="a"+1')).toBe("#VALUE!");
		expect(evaluate('=1+"a"')).toBe("#VALUE!");
		expect(evaluate("=A2-A1")).toBe("2");
		expect(evaluate("=10^400")).toBe("#VALUE!");
		expect(evaluate("=+A1")).toBe("4");
		expect(evaluate('=-"a"')).toBe("#VALUE!");
	});

	it("shows an empty cell as nothing and a boolean as TRUE or FALSE", () => {
		expect(evaluate("=A4")).toBe("");
		expect(evaluate("=TRUE")).toBe("TRUE");
		expect(evaluate("=1>2")).toBe("FALSE");
	});

	it("compares an empty cell as the other side's empty value", () => {
		expect(evaluate("=A4=0")).toBe("TRUE");
		expect(evaluate('=A4=""')).toBe("TRUE");
		expect(evaluate("=A4=FALSE")).toBe("TRUE");
		expect(evaluate("=0=A4")).toBe("TRUE");
	});

	it("orders booleans and mixed kinds, with every comparison operator", () => {
		expect(evaluate("=TRUE>FALSE")).toBe("TRUE");
		expect(evaluate('="a"<TRUE')).toBe("TRUE");
		expect(evaluate("=A1<=4")).toBe("TRUE");
		expect(evaluate("=A1>4")).toBe("FALSE");
		expect(evaluate("=A1>=5")).toBe("FALSE");
	});

	it("passes an error through a comparison or a join, on either side", () => {
		expect(evaluate("=#REF!=1")).toBe("#REF!");
		expect(evaluate("=1=#DIV/0!")).toBe("#DIV/0!");
		expect(evaluate('=#REF!&"a"')).toBe("#REF!");
		expect(evaluate('="a"&#NAME?')).toBe("#NAME?");
	});
});

describe("spreadsheet function edge cases", () => {
	it("skips text and empty cells in a range but refuses text given directly", () => {
		expect(evaluate("=SUM(A1:A4)")).toBe("10");
		expect(evaluate('=SUM("a")')).toBe("#VALUE!");
		expect(sheet({ A1: "=1/0", A2: 2, B1: "=SUM(A1:A2)" })("B1")).toBe("#DIV/0!");
	});

	it("handles aggregates over no numbers", () => {
		expect(evaluate("=AVERAGE(A3:A4)")).toBe("#DIV/0!");
		expect(evaluate("=MIN(A3:A4)")).toBe("0");
		expect(evaluate("=MAX(A3:A4)")).toBe("0");
	});

	it("refuses a range or a missing value where one value is needed", () => {
		expect(evaluate("=ABS(A1:A2)")).toBe("#VALUE!");
		expect(evaluate('=ABS("a")')).toBe("#VALUE!");
		expect(evaluate('=ROUND("a", 1)')).toBe("#VALUE!");
		expect(evaluate('=ROUND(1.5, "a")')).toBe("#VALUE!");
		expect(evaluate("=ROUND(2.5)")).toBe("3");
		expect(evaluate("=ROUND(-2.5)")).toBe("-3");
	});

	it("IF: a false condition without an else is FALSE, and a condition that is not a truth value fails", () => {
		expect(evaluate("=IF(0, 1)")).toBe("FALSE");
		expect(evaluate("=IF(0, 1, 2)")).toBe("2");
		expect(evaluate('=IF("a", 1, 2)')).toBe("#VALUE!");
		expect(evaluate("=IF(#REF!, 1, 2)")).toBe("#REF!");
	});

	it("CONCAT stops at an error; AND and OR read numbers in a range and skip text", () => {
		expect(evaluate("=CONCAT(A1, #REF!)")).toBe("#REF!");
		expect(evaluate("=AND(A1:A4)")).toBe("TRUE");
		expect(evaluate("=OR(A4:A4)")).toBe("#VALUE!");
		expect(evaluate('=AND("a")')).toBe("#VALUE!");
		expect(evaluate("=NOT(0)")).toBe("TRUE");
		expect(evaluate("=NOT(#REF!)")).toBe("#REF!");
	});
});

describe("createSpreadsheetEvaluator", () => {
	it("works out chains of formulas in any order", () => {
		const read = sheet({ A1: "=A2*2", A2: "=A3+1", A3: 5 });
		expect(read("A1")).toBe("12");
		expect(read("A2")).toBe("6");
	});

	it("shows #CYCLE! for a formula that depends on itself, directly or through others", () => {
		const read = sheet({ A1: "=A1+1", B1: "=C1", C1: "=B1", D1: "=B1+1" });
		expect(read("A1")).toBe("#CYCLE!");
		expect(read("B1")).toBe("#CYCLE!");
		expect(read("D1")).toBe("#CYCLE!");
	});

	it("works each formula cell out once", () => {
		let reads = 0;
		const evaluator = createSpreadsheetEvaluator((ref: SpreadsheetCellRef) => {
			reads += 1;
			return ref.row === 0 ? "=A2+A2+A2" : 1;
		});
		const top = { column: 0, row: 0 };
		evaluator.valueOf(top);
		evaluator.valueOf(top);
		// A1 once, A2 once: A2's value is remembered for its other two uses.
		expect(reads).toBe(2);
	});
});
