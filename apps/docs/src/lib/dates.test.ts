import { describe, expect, it } from "vitest";

import { formatEpochDate, readingMinutes } from "./dates";

describe("formatEpochDate", () => {
	it("formats an epoch-ms UTC midnight as the same calendar day", () => {
		expect(formatEpochDate(1790812800000)).toBe("Oct 1, 2026");
	});

	it("falls back to an em dash for missing or invalid input", () => {
		expect(formatEpochDate(undefined)).toBe("—");
		expect(formatEpochDate(Number.NaN)).toBe("—");
	});
});

describe("readingMinutes", () => {
	it("rounds to whole minutes with a one-minute floor", () => {
		expect(readingMinutes("short text")).toBe(1);
		expect(readingMinutes(Array.from({ length: 660 }, () => "word").join(" "))).toBe(3);
	});

	it("ignores fenced code blocks", () => {
		const code = "```ts\n" + Array.from({ length: 2000 }, () => "token").join(" ") + "\n```";
		expect(readingMinutes(`intro ${code}`)).toBe(1);
	});
});
