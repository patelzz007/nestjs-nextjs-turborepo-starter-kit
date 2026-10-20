import { describe, expect, it } from "vitest";

import { BUDGET_HEADROOM, BYTES_PER_KIB, BudgetsSchema, baselineBudget, baselineBudgets, compareToBudgets, failingRows } from "../budgets.mjs";

describe("baselineBudget", () => {
	it("is 10% headroom, rounded up to the next KiB", () => {
		expect(BUDGET_HEADROOM).toBe(1.1);
		// 100 000 × 1.1 = 110 000 bytes = 107.42 KiB → 108 KiB.
		expect(baselineBudget(100_000)).toBe(108 * BYTES_PER_KIB);
	});

	it("does not round up a result that is already whole KiB", () => {
		// 10 240 × 1.1 = 11 264 = exactly 11 KiB (a float 1.1 would give 12).
		expect(baselineBudget(10_240)).toBe(11 * BYTES_PER_KIB);
	});

	it("gives at least one KiB for a tiny bundle", () => {
		expect(baselineBudget(1)).toBe(BYTES_PER_KIB);
	});

	it.each([0, -5, 1.5, Number.NaN])("rejects %s", (bytes) => {
		expect(() => baselineBudget(bytes)).toThrow(/positive whole byte count/);
	});
});

describe("baselineBudgets", () => {
	it("applies the headroom to every app and entry", () => {
		const budgets = baselineBudgets({ web: new Map([["/", 100_000]]), mobile: new Map([["ios", 10_240]]) });
		expect(budgets).toEqual({ web: { "/": 108 * BYTES_PER_KIB }, mobile: { ios: 11 * BYTES_PER_KIB } });
		expect(BudgetsSchema.parse(budgets)).toEqual(budgets);
	});
});

describe("compareToBudgets", () => {
	const budgets = { web: { "/": 1_000, "/dashboard": 2_000, "/removed": 500 }, admin: { "/": 900 } };

	it("passes entries at or under budget", () => {
		const rows = compareToBudgets({ web: new Map([["/", 1_000]]) }, { web: { "/": 1_000 } });
		expect(rows).toEqual([{ app: "web", entry: "/", measured: 1_000, budget: 1_000, status: "ok" }]);
		expect(failingRows(rows)).toEqual([]);
	});

	it("fails an entry over budget", () => {
		const rows = compareToBudgets({ web: new Map([["/", 1_001]]) }, { web: { "/": 1_000 } });
		expect(failingRows(rows)).toEqual([{ app: "web", entry: "/", measured: 1_001, budget: 1_000, status: "over" }]);
	});

	it("fails a measured route that has no budget entry", () => {
		const rows = compareToBudgets({ web: new Map([["/new-route", 10]]) }, { web: {} });
		expect(failingRows(rows)).toEqual([{ app: "web", entry: "/new-route", measured: 10, budget: undefined, status: "missing-budget" }]);
	});

	it("fails every route of an app missing from the budgets file", () => {
		const rows = compareToBudgets({ merchant: new Map([["/", 10]]) }, budgets);
		expect(failingRows(rows).map((row) => row.status)).toEqual(["missing-budget"]);
	});

	it("fails a budget whose route no longer exists, and leaves unmeasured apps alone", () => {
		const rows = compareToBudgets(
			{
				web: new Map([
					["/", 900],
					["/dashboard", 1_500],
				]),
			},
			budgets,
		);
		expect(failingRows(rows)).toEqual([{ app: "web", entry: "/removed", measured: undefined, budget: 500, status: "stale-budget" }]);
		expect(rows.some((row) => row.app === "admin")).toBe(false);
	});
});

describe("BudgetsSchema", () => {
	it.each([{ web: { "/": 0 } }, { web: { "/": 1.5 } }, { web: { "/": "1kb" } }, { web: [] }])("rejects %j", (value) => {
		expect(BudgetsSchema.safeParse(value).success).toBe(false);
	});
});
