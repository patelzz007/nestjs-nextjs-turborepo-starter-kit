import { describe, expect, it } from "vitest";

import { BENCHMARK_IDS, benchmarkFixtureSql, formatBenchmark, median, overBudget, parseBenchmarkOptions, type BenchmarkResult } from "../rls-benchmark";

const RESULT: BenchmarkResult = { name: "count", superuserMs: 2, memberMs: 5, overhead: 2.5, memberRows: 1 };

describe("parseBenchmarkOptions", () => {
	it("defaults to 100 000 rows and 5 runs, report only", () => {
		expect(parseBenchmarkOptions([])).toStrictEqual({ rows: 100_000, runs: 5, maxOverhead: undefined });
	});

	it("reads the rows, runs and overhead budget, and refuses a nonsense value", () => {
		expect(parseBenchmarkOptions(["--rows", "500", "--runs", "3", "--max-overhead", "4"])).toStrictEqual({ rows: 500, runs: 3, maxOverhead: 4 });
		expect(() => parseBenchmarkOptions(["--rows", "-1"])).toThrow();
		expect(() => parseBenchmarkOptions(["--max-overhead", "fast"])).toThrow();
	});
});

describe("benchmarkFixtureSql", () => {
	it("generates the sales and a tenth as many rewards for the one tenant", () => {
		const sql = benchmarkFixtureSql(1000);
		expect(sql).toContain("generate_series(1, 1000)");
		expect(sql).toContain("generate_series(1, 100)");
		expect(sql).toContain(`'${BENCHMARK_IDS.tenant}'`);
	});
});

describe("median", () => {
	it("takes the middle value, or the mean of the two middle values", () => {
		expect(median([5, 1, 3])).toBe(3);
		expect(median([4, 1, 3, 2])).toBe(2.5);
	});
});

describe("results", () => {
	it("prints each query's timings and ratio", () => {
		expect(formatBenchmark([RESULT])).toContain("superuser 2.00 ms · member (RLS) 5.00 ms · ×2.50 · 1 row(s)");
	});

	it("reports the queries over the budget, and none without one", () => {
		expect(overBudget([RESULT], 2)).toStrictEqual([RESULT]);
		expect(overBudget([RESULT], 3)).toStrictEqual([]);
		expect(overBudget([RESULT], undefined)).toStrictEqual([]);
	});
});
