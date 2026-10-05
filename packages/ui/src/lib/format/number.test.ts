import { describe, expect, it } from "vitest";

import { formatCount, formatPercent, formatPercentChange } from "./number";

describe("formatCount", () => {
	it("groups digits the way the given locale does", () => {
		expect(formatCount(1_234_567, "en-MY")).toBe("1,234,567");
		expect(formatCount(1_234_567, "de-DE")).toBe("1.234.567");
		expect(formatCount(0, "en-MY")).toBe("0");
	});
});

describe("formatPercent", () => {
	it("takes percent units and keeps at most one decimal", () => {
		expect(formatPercent(12.5, "en-MY")).toBe("12.5%");
		expect(formatPercent(87.84, "en-MY")).toBe("87.8%");
		expect(formatPercent(100, "en-MY")).toBe("100%");
		expect(formatPercent(0, "en-MY")).toBe("0%");
	});

	it("follows the locale's decimal separator", () => {
		expect(formatPercent(12.5, "de-DE")).toBe("12,5 %");
	});
});

describe("formatPercentChange", () => {
	it("always signs a non-zero change and leaves zero unsigned", () => {
		expect(formatPercentChange(12.5, "en-MY")).toBe("+12.5%");
		expect(formatPercentChange(-3, "en-MY")).toBe("-3%");
		expect(formatPercentChange(0, "en-MY")).toBe("0%");
	});
});
