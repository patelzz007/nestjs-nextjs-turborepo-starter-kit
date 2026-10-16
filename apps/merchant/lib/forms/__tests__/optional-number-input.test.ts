import { describe, expect, it } from "vitest";

import { optionalNumberInput } from "../optional-number-input";

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

	it("keeps a default value that is already a number, as an edited reward's saved minimum spend is", () => {
		expect(optionalNumberInput(30)).toBe(30);
		expect(optionalNumberInput(0)).toBe(0);
	});

	it("treats an absent default value as not given", () => {
		expect(optionalNumberInput(undefined)).toBeUndefined();
		expect(optionalNumberInput(null)).toBeUndefined();
	});
});
