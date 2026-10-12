import { describe, expect, it } from "vitest";

import { optionalNumberInput } from "./optional-number-input";

describe("optionalNumberInput", () => {
	it("treats an empty or blank field as not given", () => {
		expect(optionalNumberInput("")).toBeUndefined();
		expect(optionalNumberInput("  ")).toBeUndefined();
	});

	it("reads a filled field as its number (the schema still rejects a value that is not one)", () => {
		expect(optionalNumberInput("35")).toBe(35);
		expect(optionalNumberInput("12.5")).toBe(12.5);
		expect(optionalNumberInput("abc")).toBeNaN();
	});
});
