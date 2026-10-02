import { describe, expect, it } from "vitest";

import { formatMinorUnits, formatMinorUnitsCompact, minorToMajorUnits, minorUnitDigits, MONEY_DISPLAY_LOCALE } from "./money";

/** Intl separates the currency symbol from the amount with a no-break space. */
const NBSP = " ";

describe("minorUnitDigits", () => {
	it("reads two minor digits for ringgit and zero for yen", () => {
		expect(minorUnitDigits("MYR")).toBe(2);
		expect(minorUnitDigits("JPY")).toBe(0);
	});
});

describe("minorToMajorUnits", () => {
	it("divides by the currency's minor-unit factor", () => {
		expect(minorToMajorUnits(123_450, "MYR")).toBe(1234.5);
		expect(minorToMajorUnits(1_500, "JPY")).toBe(1500);
	});
});

describe("formatMinorUnits", () => {
	it("renders sen as ringgit with two decimals", () => {
		expect(formatMinorUnits(123_450, "MYR")).toBe(`RM${NBSP}1,234.50`);
	});

	it("renders zero and sub-ringgit amounts", () => {
		expect(formatMinorUnits(0, "MYR")).toBe(`RM${NBSP}0.00`);
		expect(formatMinorUnits(5, "MYR")).toBe(`RM${NBSP}0.05`);
	});

	it("renders negative amounts with a leading sign", () => {
		expect(formatMinorUnits(-1_230, "MYR")).toBe(`-RM${NBSP}12.30`);
	});

	it("respects currencies without minor digits", () => {
		expect(formatMinorUnits(1_500, "JPY")).toBe("JP¥1,500");
	});

	it("formats in the Malaysian English locale", () => {
		expect(MONEY_DISPLAY_LOCALE).toBe("en-MY");
	});
});

describe("formatMinorUnitsCompact", () => {
	it("abbreviates thousands and millions with one decimal at most", () => {
		expect(formatMinorUnitsCompact(12_345_678, "MYR")).toBe(`RM${NBSP}123.5K`);
		expect(formatMinorUnitsCompact(123_456_700, "MYR")).toBe(`RM${NBSP}1.2M`);
	});

	it("drops decimals on small round amounts", () => {
		expect(formatMinorUnitsCompact(0, "MYR")).toBe(`RM${NBSP}0`);
		expect(formatMinorUnitsCompact(99_900, "MYR")).toBe(`RM${NBSP}999`);
	});
});
