import { describe, expect, it } from "vitest";

import { formatSpreadsheetFormula, isSpreadsheetFormula, parseSpreadsheetFormula, shiftSpreadsheetFormula } from "../formula-parser";

/** Parses and writes back: the shortest way to check the tree's shape, including where the brackets go. */
function roundTrip(formula: string): string {
	return formatSpreadsheetFormula(parseSpreadsheetFormula(formula));
}

describe("isSpreadsheetFormula", () => {
	it("is a formula when the text starts with =", () => {
		expect(isSpreadsheetFormula("=A1")).toBe(true);
		expect(isSpreadsheetFormula("A1")).toBe(false);
		expect(isSpreadsheetFormula(" =A1")).toBe(false);
	});
});

describe("parseSpreadsheetFormula", () => {
	it("reads numbers, text, booleans and references", () => {
		expect(parseSpreadsheetFormula("=12.5")).toEqual({ kind: "number", value: 12.5 });
		expect(parseSpreadsheetFormula('="say ""hi"""')).toEqual({ kind: "string", value: 'say "hi"' });
		expect(parseSpreadsheetFormula("=true")).toEqual({ kind: "boolean", value: true });
		expect(parseSpreadsheetFormula("=$B2")).toEqual({ kind: "cell", cell: { ref: { column: 1, row: 1 }, absoluteColumn: true, absoluteRow: false } });
	});

	it("reads a range and a function call with several arguments", () => {
		const node = parseSpreadsheetFormula("=sum(A1:B2, 3)");
		expect(node.kind).toBe("call");
		expect(roundTrip("=sum(A1:B2, 3)")).toBe("=SUM(A1:B2,3)");
		expect(roundTrip("=NOW()")).toBe("=NOW()");
	});

	it("applies the usual precedence", () => {
		expect(roundTrip("=1+2*3")).toBe("=1+2*3");
		expect(roundTrip("=(1+2)*3")).toBe("=(1+2)*3");
		expect(roundTrip("=1-(2-3)")).toBe("=1-(2-3)");
		expect(roundTrip("=1-2-3")).toBe("=1-2-3");
		expect(roundTrip("=2^3^2")).toBe("=2^3^2");
		expect(roundTrip("=(2^3)^2")).toBe("=(2^3)^2");
		expect(roundTrip("=-A1^2")).toBe("=-A1^2");
		expect(roundTrip('=A1&"x"=B1')).toBe('=A1&"x"=B1');
		expect(roundTrip("=A1<=B1")).toBe("=A1<=B1");
	});

	it("reads an unknown name as a name, so it can evaluate to #NAME?", () => {
		expect(parseSpreadsheetFormula("=price")).toEqual({ kind: "name", name: "price" });
	});

	it("reads text that is not a formula as invalid", () => {
		for (const broken of ["=", "=1+", "=(1", "=SUM(1,", "=A1:", "=1 2", "=#", "=1)"]) {
			expect(parseSpreadsheetFormula(broken)).toEqual({ kind: "invalid" });
		}
	});
});

describe("shiftSpreadsheetFormula", () => {
	it("moves relative references with the formula, and keeps $ parts where they are", () => {
		expect(shiftSpreadsheetFormula("=A1+$B$1+$C1+D$1", 2, 1)).toBe("=B3+$B$1+$C3+E$1");
	});

	it("moves both ends of a range", () => {
		expect(shiftSpreadsheetFormula("=SUM(A1:A3)", 1, 0)).toBe("=SUM(A2:A4)");
	});

	it("turns a reference moved off the sheet into #REF!, which reads back as that error", () => {
		const shifted = shiftSpreadsheetFormula("=A1*2", -1, 0);
		expect(shifted).toBe("=#REF!*2");
		expect(parseSpreadsheetFormula(shifted)).toEqual({ kind: "binary", operator: "*", left: { kind: "error", error: "#REF!" }, right: { kind: "number", value: 2 } });
	});

	it("leaves plain text and broken formulas alone", () => {
		expect(shiftSpreadsheetFormula("A1", 1, 1)).toBe("A1");
		expect(shiftSpreadsheetFormula("=1+", 1, 1)).toBe("=1+");
	});
});

describe("formula syntax errors and edge cases", () => {
	it("reads a broken formula as invalid", () => {
		expect(parseSpreadsheetFormula("=1 ?").kind).toBe("invalid");
		expect(parseSpreadsheetFormula("=2^").kind).toBe("invalid");
		expect(parseSpreadsheetFormula("=-").kind).toBe("invalid");
		expect(parseSpreadsheetFormula("=)").kind).toBe("invalid");
		expect(parseSpreadsheetFormula("=SUM(1 2)").kind).toBe("invalid");
		expect(parseSpreadsheetFormula("=").kind).toBe("invalid");
	});

	it("reads text without the leading = as a formula body", () => {
		expect(formatSpreadsheetFormula(parseSpreadsheetFormula("1+2"))).toBe("=1+2");
	});

	it("writes quotes inside text, booleans and a bracketed unary operand back exactly", () => {
		expect(roundTrip('="say ""hi"""')).toBe('="say ""hi"""');
		expect(roundTrip("=TRUE")).toBe("=TRUE");
		expect(roundTrip("=-(1+2)")).toBe("=-(1+2)");
		expect(roundTrip("=+A1")).toBe("=+A1");
	});

	it("turns a range moved off the sheet into #REF!, and moves one that stays on it", () => {
		expect(shiftSpreadsheetFormula("=SUM(A1:B2)", -1, 0)).toBe("=SUM(#REF!)");
		expect(shiftSpreadsheetFormula("=SUM(A1:B2)", 1, 1)).toBe("=SUM(B2:C3)");
		expect(shiftSpreadsheetFormula("=-A1", 1, 0)).toBe("=-A2");
	});
});
