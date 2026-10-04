import { describe, expect, it } from "vitest";

import { minorUnitsToNumber, MinorUnitsOverflowError } from "./minor-units.util";

describe("minorUnitsToNumber", () => {
	it("carries 64-bit totals beyond 32 bits exactly", () => {
		// 2^31 sen (≈ RM 21.5 million) overflowed the old INT column; it is an ordinary platform total.
		expect(minorUnitsToNumber(2_147_483_648n)).toBe(2_147_483_648);
		expect(minorUnitsToNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("refuses an amount JSON cannot carry exactly instead of rounding it", () => {
		expect(() => minorUnitsToNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(MinorUnitsOverflowError);
	});
});
