import { MAX_BILL_TOTAL_MINOR } from "@workspace/shared";

import { formatBillAmount, parseBillAmount } from "../bill-amount";

describe("parseBillAmount", () => {
	it("reads whole and decimal ringgit as sen", () => {
		expect(parseBillAmount("25", "MYR")).toBe(2500);
		expect(parseBillAmount("25.5", "MYR")).toBe(2550);
		expect(parseBillAmount("25.50", "MYR")).toBe(2550);
		expect(parseBillAmount("0.05", "MYR")).toBe(5);
		expect(parseBillAmount(".5", "MYR")).toBe(50);
		expect(parseBillAmount("25.", "MYR")).toBe(2500);
	});

	it("ignores grouping separators and surrounding spaces", () => {
		expect(parseBillAmount(" 1,234.50 ", "MYR")).toBe(123450);
		expect(parseBillAmount("1 234", "MYR")).toBe(123400);
	});

	it("accepts a zero bill (a fully discounted one)", () => {
		expect(parseBillAmount("0", "MYR")).toBe(0);
	});

	it("rejects what is not an amount", () => {
		expect(parseBillAmount("", "MYR")).toBeNull();
		expect(parseBillAmount(".", "MYR")).toBeNull();
		expect(parseBillAmount("abc", "MYR")).toBeNull();
		expect(parseBillAmount("-5", "MYR")).toBeNull();
		expect(parseBillAmount("1.2.3", "MYR")).toBeNull();
		expect(parseBillAmount("1e3", "MYR")).toBeNull();
	});

	it("rejects more decimals than the currency has", () => {
		expect(parseBillAmount("25.505", "MYR")).toBeNull();
	});

	it("rejects a bill over the largest the API accepts", () => {
		expect(parseBillAmount("1000000", "MYR")).toBe(MAX_BILL_TOTAL_MINOR);
		expect(parseBillAmount("1000000.01", "MYR")).toBeNull();
	});
});

describe("formatBillAmount", () => {
	it("shows sen as ringgit with both decimals", () => {
		expect(formatBillAmount(2550, "MYR")).toMatch(/^RM\s?25\.50$/u);
		expect(formatBillAmount(123450, "MYR")).toMatch(/^RM\s?1,234\.50$/u);
	});
});
