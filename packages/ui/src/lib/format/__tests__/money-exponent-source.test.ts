import { describe, expect, it, vi } from "vitest";

import { formatMinorUnits, minorToMajorUnits, minorUnitExponent } from "./money";

/**
 * A table entry that disagrees with ICU on purpose: ICU displays MYR with 2
 * fraction digits, this table says 3. Every assertion below can only pass if
 * the money helpers take the exponent from the shared table — deriving it
 * from `Intl` (ICU display precision) would give 2.
 */
const TABLE_EXPONENT: number = vi.hoisted((): number => 3);

vi.mock("@workspace/shared", async (importOriginal: () => Promise<typeof import("@workspace/shared")>): Promise<typeof import("@workspace/shared")> => {
	const actual = await importOriginal();
	return { ...actual, SALE_CURRENCY_MINOR_UNIT_EXPONENTS: { MYR: TABLE_EXPONENT } };
});

describe("money helpers take the minor-unit exponent from the shared table, not from ICU", () => {
	it("ICU's display precision for MYR differs from the table under test", () => {
		expect(new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).resolvedOptions().maximumFractionDigits).not.toBe(TABLE_EXPONENT);
	});

	it("scales and renders by the table's exponent", () => {
		expect(minorUnitExponent("MYR")).toBe(TABLE_EXPONENT);
		expect(minorToMajorUnits(1_234, "MYR")).toBe(1.234);
		expect(formatMinorUnits(1_234, "MYR", "en-MY")).toBe("RM 1.234");
	});
});
