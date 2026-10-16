import { SALE_CURRENCY_MINOR_UNIT_EXPONENTS, SaleCurrencySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { formatMinorUnits, formatMinorUnitsCompact, minorToMajorUnits, minorUnitExponent } from "./money";

/** Intl separates the currency symbol from the amount with a no-break space. */
/** Formatters normalise every ICU space variant to a plain space (see intl-text.ts). */
const SPACE = " ";
const MALAYSIAN_ENGLISH = "en-MY";
const US_ENGLISH = "en-US";
const GERMAN = "de-DE";

describe("minorUnitExponent", () => {
	it("reads every sale currency's exponent from the shared ISO 4217 table", () => {
		for (const currency of SaleCurrencySchema.options) {
			expect(minorUnitExponent(currency)).toBe(SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency]);
		}
		expect(minorUnitExponent("MYR")).toBe(2);
	});
});

describe("minorToMajorUnits", () => {
	it("divides by the currency's minor-unit factor", () => {
		expect(minorToMajorUnits(123_450, "MYR")).toBe(1234.5);
		expect(minorToMajorUnits(5, "MYR")).toBe(0.05);
	});
});

describe("formatMinorUnits", () => {
	it("renders sen as ringgit with two decimals", () => {
		expect(formatMinorUnits(123_450, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}1,234.50`);
	});

	it("renders zero and sub-ringgit amounts", () => {
		expect(formatMinorUnits(0, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}0.00`);
		expect(formatMinorUnits(5, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}0.05`);
	});

	it("renders negative amounts with a leading sign", () => {
		expect(formatMinorUnits(-1_230, "MYR", MALAYSIAN_ENGLISH)).toBe(`-RM${SPACE}12.30`);
	});

	it("formats in the locale it is given — never the runtime's default", () => {
		expect(formatMinorUnits(123_450, "MYR", US_ENGLISH)).toBe(`MYR${SPACE}1,234.50`);
		expect(formatMinorUnits(123_450, "MYR", GERMAN)).toBe(`1.234,50${SPACE}MYR`);
	});
});

describe("formatMinorUnitsCompact", () => {
	it("abbreviates thousands and millions with one decimal at most", () => {
		expect(formatMinorUnitsCompact(12_345_678, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}123.5K`);
		expect(formatMinorUnitsCompact(123_456_700, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}1.2M`);
	});

	it("drops decimals on small round amounts", () => {
		expect(formatMinorUnitsCompact(0, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}0`);
		expect(formatMinorUnitsCompact(99_900, "MYR", MALAYSIAN_ENGLISH)).toBe(`RM${SPACE}999`);
	});
});
