import { describe, expect, it } from "vitest";

import { countWords, formatEpochDate, minutesForWords, readingMinutes, WORDS_PER_MINUTE } from "../dates";

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

describe("word counts", () => {
	it("should count whitespace-separated words", () => {
		expect(countWords("  one two\nthree\tfour  ")).toBe(4);
		expect(countWords("")).toBe(0);
	});

	it("should turn words into whole minutes, with 0 for nothing and 1 for a little", () => {
		expect(minutesForWords(0)).toBe(0);
		expect(minutesForWords(5)).toBe(1);
		expect(minutesForWords(WORDS_PER_MINUTE * 4)).toBe(4);
	});
});
