import { DAY_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ANALYTICS_HISTORY_DAYS, buildAnalyticsHistoryPlan, HISTORY_REWARDS, HISTORY_STORES, rewardWindow, type AnalyticsHistoryPlan } from "../analytics-history";
import { SeededRandom } from "../prng";

const NOW = Date.UTC(2026, 9, 5, 4);
const CUSTOMERS = Array.from({ length: 24 }, (_unused, index) => `customer-${String(index).padStart(2, "0")}`);
const SEED = 42;

function plan(seed: number = SEED): AnalyticsHistoryPlan {
	return buildAnalyticsHistoryPlan({ random: SeededRandom.derive(seed, "analytics-history"), nowMs: NOW, customerIds: CUSTOMERS, tierCast: null });
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
			expect(reward.tenantId).toBe(store.tenantId);
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

describe("the scripted tier cast (ADR 085)", () => {
	const [lapsing, lapsed] = CUSTOMERS;
	const cast = buildAnalyticsHistoryPlan({
		random: SeededRandom.derive(SEED, "analytics-history"),
		nowMs: NOW,
		customerIds: CUSTOMERS,
		tierCast: { lapsingUserId: lapsing ?? "", lapsedUserId: lapsed ?? "" },
	});
	const billsOf = (userId: string | undefined): readonly number[] =>
		cast.claims.flatMap((claim) => (claim.userId === userId && claim.checkout !== null ? [claim.checkout.paidAt] : [])).sort((left, right) => left - right);

	it("gives each cast member only their scripted daily bills, none from the random history", () => {
		expect(billsOf(lapsing)).toHaveLength(12);
		expect(billsOf(lapsed)).toHaveLength(11);
		expect(cast.claims.filter((claim) => claim.userId === lapsing && claim.status === "EXPIRED")).toEqual([]);
	});

	it("places them a year back: the lapsing customer's first bill leaves the 12-month window in under two weeks", () => {
		const [first] = billsOf(lapsing);
		expect(first).toBeDefined();
		expect((first ?? 0) + 365 * DAY_MS - NOW).toBeLessThan(14 * DAY_MS);
		expect((first ?? 0) + 365 * DAY_MS - NOW).toBeGreaterThan(0);
		const [lapsedFirst] = billsOf(lapsed);
		expect((lapsedFirst ?? 0) + 365 * DAY_MS).toBeLessThan(NOW);
	});

	it("redeems inside the claim window, while the morning-brew reward runs", () => {
		const reward = HISTORY_REWARDS.find((entry) => entry.key === "kl-morning-brew");
		expect(reward).toBeDefined();
		const window = reward === undefined ? { startMs: 0, endMs: 0 } : rewardWindow(reward, NOW);
		for (const claim of cast.claims.filter((entry) => entry.userId === lapsing || entry.userId === lapsed)) {
			expect(claim.claimedAt).toBeGreaterThanOrEqual(window.startMs);
			expect(claim.checkout?.paidAt ?? 0).toBeLessThanOrEqual(claim.claimExpiresAt);
		}
	});
});
