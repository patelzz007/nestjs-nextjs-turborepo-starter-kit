import { DAY_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ANALYTICS_HISTORY_DAYS, buildAnalyticsHistoryPlan, HISTORY_REWARDS, HISTORY_STORES, rewardWindow, type AnalyticsHistoryPlan } from "./analytics-history";
import { SeededRandom } from "./prng";

const NOW = Date.UTC(2026, 9, 5, 4);
const CUSTOMERS = Array.from({ length: 24 }, (_unused, index) => `customer-${String(index).padStart(2, "0")}`);
const SEED = 42;

function plan(seed: number = SEED): AnalyticsHistoryPlan {
	return buildAnalyticsHistoryPlan({ random: SeededRandom.derive(seed, "analytics-history"), nowMs: NOW, customerIds: CUSTOMERS });
}

describe("buildAnalyticsHistoryPlan", () => {
	const history = plan();
	const rewardsByKey = new Map(HISTORY_REWARDS.map((reward) => [reward.key, reward]));
	const storesByKey = new Map(HISTORY_STORES.map((store) => [store.key, store]));

	it("is deterministic for a seed and differs between seeds", () => {
		expect(plan()).toEqual(history);
		expect(plan(SEED + 1)).not.toEqual(history);
	});

	it("redeems every redeemed claim inside its window, at a store the reward is offered at, while the reward runs, above its minimum spend", () => {
		const redeemed = history.claims.filter((claim) => claim.status === "REDEEMED");
		expect(redeemed.length).toBeGreaterThan(1_000);
		for (const claim of redeemed) {
			const reward = rewardsByKey.get(claim.rewardKey);
			const store = storesByKey.get(claim.checkout?.storeKey ?? "");
			expect(reward).toBeDefined();
			expect(store).toBeDefined();
			if (reward === undefined || store === undefined || claim.checkout === null) continue;
			const window = rewardWindow(reward, NOW);
			expect(claim.claimedAt).toBeLessThan(claim.checkout.paidAt);
			expect(claim.checkout.paidAt).toBeLessThanOrEqual(claim.claimExpiresAt);
			expect(claim.claimedAt).toBeGreaterThanOrEqual(window.startMs);
			expect(claim.checkout.paidAt).toBeLessThanOrEqual(window.endMs);
			expect(claim.checkout.paidAt).toBeLessThan(NOW);
			expect(reward.organizationId).toBe(store.organizationId);
			expect(reward.locationIds === null || reward.locationIds.includes(store.locationId)).toBe(true);
			expect(claim.checkout.billTotalMinor).toBeGreaterThanOrEqual(reward.minSpendMinor);
		}
	});

	it("leaves the other claims EXPIRED, their window over, with no bill", () => {
		const expired = history.claims.filter((claim) => claim.status === "EXPIRED");
		expect(expired.length).toBeGreaterThan(0);
		for (const claim of expired) {
			expect(claim.checkout).toBeNull();
			expect(claim.claimExpiresAt).toBeLessThan(NOW);
		}
	});

	it("spreads activity over every month of the year, every store, both redemption methods", () => {
		const bills = history.claims.flatMap((claim) => (claim.checkout === null ? [] : [claim.checkout]));
		const months = new Set(bills.map((bill) => new Date(bill.paidAt).toISOString().slice(0, "YYYY-MM".length)));
		expect(months.size).toBeGreaterThanOrEqual(12);
		expect(new Set(bills.map((bill) => bill.storeKey))).toEqual(new Set(HISTORY_STORES.map((store) => store.key)));
		expect(new Set(bills.map((bill) => bill.redemptionMethod))).toEqual(new Set(["SCAN", "MANUAL"]));
		expect(Math.min(...bills.map((bill) => bill.paidAt))).toBeGreaterThanOrEqual(NOW - (ANALYTICS_HISTORY_DAYS + 1) * DAY_MS);
	});

	it("lets customers join over the year, so new and returning customers both show", () => {
		const firstBill = new Map<string, number>();
		for (const claim of history.claims) {
			if (claim.checkout !== null) firstBill.set(claim.userId, Math.min(firstBill.get(claim.userId) ?? Number.POSITIVE_INFINITY, claim.checkout.paidAt));
		}
		const firstMonths = new Set([...firstBill.values()].map((paidAt) => new Date(paidAt).toISOString().slice(0, "YYYY-MM".length)));
		expect(firstBill.size).toBe(CUSTOMERS.length);
		expect(firstMonths.size).toBeGreaterThanOrEqual(6);
	});
});
