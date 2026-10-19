import { describe, expect, it } from "vitest";

import { elapsedMs, median, summarizeRuns } from "../timing.mjs";

describe("elapsedMs", () => {
	it("is the rounded difference of two clock readings", () => {
		expect(elapsedMs(1_000.25, 2_501)).toBe(1_501);
		expect(elapsedMs(5, 5)).toBe(0);
	});

	it("rejects an end before the start", () => {
		expect(() => elapsedMs(10, 9)).toThrow(/before start/);
	});

	it.each([
		[Number.NaN, 1],
		[1, Number.POSITIVE_INFINITY],
	])("rejects non-finite readings (%s, %s)", (start, end) => {
		expect(() => elapsedMs(start, end)).toThrow(/finite/);
	});
});

describe("median", () => {
	it("is undefined for no values", () => {
		expect(median([])).toBeUndefined();
	});

	it("is the only value of a single run", () => {
		expect(median([1_234])).toBe(1_234);
	});

	it("is the middle value of an odd count, regardless of order", () => {
		expect(median([9_000, 3_000, 4_000])).toBe(4_000);
	});

	it("is the rounded mean of the two middle values of an even count", () => {
		expect(median([1, 4, 2, 10])).toBe(3);
		expect(median([1, 2])).toBe(2);
	});

	it("does not reorder the caller's list", () => {
		const values = [3, 1, 2];
		median(values);
		expect(values).toEqual([3, 1, 2]);
	});
});

describe("summarizeRuns", () => {
	it("takes the median per (phase, target) across runs, in first-seen order", () => {
		const runs = [
			[
				{ phase: "A", target: "api", ms: 10_000 },
				{ phase: "B", target: "api", ms: 4_000 },
			],
			[
				{ phase: "A", target: "api", ms: 12_000 },
				{ phase: "B", target: "api", ms: 6_000 },
			],
			[{ phase: "A", target: "api", ms: 11_000 }],
		];
		expect(summarizeRuns(runs)).toEqual([
			{ phase: "A", target: "api", medianMs: 11_000, runs: 3 },
			{ phase: "B", target: "api", medianMs: 5_000, runs: 2 },
		]);
	});

	it("keeps the same target of different phases apart", () => {
		const summary = summarizeRuns([
			[
				{ phase: "A", target: "web", ms: 1 },
				{ phase: "C", target: "web", ms: 2 },
			],
		]);
		expect(summary.map(({ phase, target }) => `${phase}/${target}`)).toEqual(["A/web", "C/web"]);
	});

	it("is empty for runs that measured nothing", () => {
		expect(summarizeRuns([[], []])).toEqual([]);
	});
});
