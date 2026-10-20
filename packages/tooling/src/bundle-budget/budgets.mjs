/**
 * The budget rules of `pnpm bundle:check` (plan §19.6, decision #57): the
 * shape of `bundle-budgets.json`, the baseline it is generated from, and the
 * comparison that fails CI.
 */
import { z } from "zod";

/**
 * Baseline headroom: budgets are 10% above the measured size (decision #57).
 * Kept as an integer ratio so the KiB rounding is exact (1.1 has no exact
 * binary form: 10240 × 1.1 would round up to 12 KiB instead of 11).
 */
const HEADROOM_NUMERATOR = 11;
const HEADROOM_DENOMINATOR = 10;
export const BUDGET_HEADROOM = HEADROOM_NUMERATOR / HEADROOM_DENOMINATOR;
/** Budgets are rounded UP to whole KiB, so a baseline never starts at the exact edge. */
export const BYTES_PER_KIB = 1024;

/**
 * `{ "<app>": { "<route or platform>": <bytes> } }`, e.g.
 * `{ "web": { "/": 245760 }, "mobile": { "ios": 7798784 } }`.
 */
export const BudgetsSchema = z.record(z.string().min(1), z.record(z.string().min(1), z.number().int().positive()));

/**
 * @typedef {z.infer<typeof BudgetsSchema>} Budgets
 * @typedef {Readonly<Record<string, ReadonlyMap<string, number>>>} Measured
 * @typedef {{ app: string, entry: string, measured: number | undefined, budget: number | undefined, status: "ok" | "over" | "missing-budget" | "stale-budget" }} BudgetRow
 */

/**
 * The budget for a measured size: size × headroom, rounded up to the next KiB.
 *
 * @param {number} measuredBytes
 * @returns {number}
 */
export function baselineBudget(measuredBytes) {
	if (!Number.isInteger(measuredBytes) || measuredBytes <= 0) {
		throw new Error(`baselineBudget needs a positive whole byte count, got ${String(measuredBytes)}`);
	}
	return Math.ceil((measuredBytes * HEADROOM_NUMERATOR) / (HEADROOM_DENOMINATOR * BYTES_PER_KIB)) * BYTES_PER_KIB;
}

/**
 * @param {Measured} measured
 * @returns {Budgets}
 */
export function baselineBudgets(measured) {
	return Object.fromEntries(Object.entries(measured).map(([app, entries]) => [app, Object.fromEntries([...entries].map(([entry, bytes]) => [entry, baselineBudget(bytes)]))]));
}

/**
 * Every measured entry against its budget. A measured route without a budget
 * fails (a new route must add one), and so does a budget whose route no
 * longer exists (the file must describe the real app). Budgets of apps that
 * were not measured are left alone.
 *
 * @param {Measured} measured
 * @param {Budgets} budgets
 * @returns {BudgetRow[]}
 */
export function compareToBudgets(measured, budgets) {
	/** @type {BudgetRow[]} */
	const rows = [];
	for (const [app, entries] of Object.entries(measured)) {
		const appBudgets = budgets[app] ?? {};
		for (const [entry, bytes] of entries) {
			const budget = appBudgets[entry];
			const status = budget === undefined ? "missing-budget" : bytes > budget ? "over" : "ok";
			rows.push({ app, entry, measured: bytes, budget, status });
		}
		for (const [entry, budget] of Object.entries(appBudgets)) {
			if (!entries.has(entry)) {
				rows.push({ app, entry, measured: undefined, budget, status: "stale-budget" });
			}
		}
	}
	return rows;
}

/**
 * @param {readonly BudgetRow[]} rows
 * @returns {BudgetRow[]}
 */
export function failingRows(rows) {
	return rows.filter((row) => row.status !== "ok");
}
