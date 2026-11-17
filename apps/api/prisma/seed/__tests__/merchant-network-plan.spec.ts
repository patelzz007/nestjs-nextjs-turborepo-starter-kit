import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DAY_MS, DEFAULT_TIER_RULES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	buildMerchantNetworkPlan,
	LOYAL_MERCHANT_COUNT,
	LOYAL_VISITS_PER_MERCHANT,
	NETWORK_TENANTS,
	networkTenants,
	REWARDS_PER_LOCATION,
	type MerchantNetworkPlan,
} from "../merchant-network-plan";
import { SeededRandom } from "../prng";

const NOW = Date.UTC(2026, 10, 17, 4);
const CUSTOMERS = Array.from({ length: 20 }, (_unused, index) => `customer-${String(index).padStart(2, "0")}`);
const LOYAL = CUSTOMERS.slice(0, LOYAL_MERCHANT_COUNT);
const SEED = 7;
const MIN_LOCATIONS = 3;
const MAX_LOCATIONS = 5;
const YEAR_MS = 365 * DAY_MS;
/** The committed reward photos (prisma/seed/assets/reward-images). */
const IMAGE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "reward-images");

function plan(seed: number = SEED): MerchantNetworkPlan {
	return buildMerchantNetworkPlan({ random: SeededRandom.derive(seed, "merchant-network"), nowMs: NOW, customerIds: CUSTOMERS, loyalCustomerIds: LOYAL });
}

describe("buildMerchantNetworkPlan", () => {
	const network = plan();
	const rewardsByKey = new Map(network.rewards.map((reward) => [reward.key, reward]));
	const locationsByKey = new Map(network.tenants.flatMap((tenant) => tenant.locations.map((location) => [location.key, location])));

	it("is deterministic for a seed; its structure doesn't depend on the seed", () => {
		expect(plan()).toEqual(network);
		const other = plan(SEED + 1);
		expect(other.tenants).toEqual(network.tenants);
		expect(other.rewards.map((reward) => reward.id)).toEqual(network.rewards.map((reward) => reward.id));
	});

	it("adds six merchants with 3–5 branches each, every branch offering 50 rewards", () => {
		expect(network.tenants).toHaveLength(NETWORK_TENANTS.length);
		for (const tenant of network.tenants) {
			expect(tenant.locations.length).toBeGreaterThanOrEqual(MIN_LOCATIONS);
			expect(tenant.locations.length).toBeLessThanOrEqual(MAX_LOCATIONS);
			expect(tenant.locations.filter((location) => location.isPrimary)).toHaveLength(1);
			for (const location of tenant.locations) {
				expect(network.rewards.filter((reward) => reward.locationId === location.id)).toHaveLength(REWARDS_PER_LOCATION);
			}
		}
		expect(new Set(network.tenants.map((tenant) => tenant.slug)).size).toBe(network.tenants.length);
		expect(new Set(network.rewards.map((reward) => reward.id)).size).toBe(network.rewards.length);
	});

	it("gives every reward a real title, a window that starts before it ends, and a minimum spend a free item is worth", () => {
		for (const reward of network.rewards) {
			expect(reward.title.length).toBeGreaterThan(0);
			expect(reward.startMs).toBeLessThan(reward.endMs);
			expect(reward.minSpendMinor).toBeGreaterThan(0);
			if (reward.rewardType === "FREE_ITEM" || reward.rewardType === "BOGO") {
				expect(reward.freeItemName).not.toBeNull();
				expect(reward.freeItemSku).not.toBeNull();
			}
		}
		expect(network.rewards.some((reward) => reward.minimumTier !== "BRONZE")).toBe(true);
	});

	it("gives every reward an image: one of its merchant's photo sets, each with a committed cover, every set in use", () => {
		for (const tenant of network.tenants) {
			const shown = new Set(network.rewards.filter((reward) => reward.tenantId === tenant.id).map((reward) => reward.imageSet));
			expect([...shown].sort()).toEqual([...tenant.imageSets].sort());
			for (const slug of tenant.imageSets) {
				expect(existsSync(join(IMAGE_DIRECTORY, slug, "01.webp")), slug).toBe(true);
			}
		}
	});

	it("redeems every claim at its reward's branch, inside both windows, above the minimum spend, and only Bronze rewards", () => {
		for (const claim of network.claims.filter((each) => each.status === "REDEEMED")) {
			const reward = rewardsByKey.get(claim.rewardKey);
			const location = locationsByKey.get(claim.checkout?.locationKey ?? "");
			expect(reward?.id).toBe(claim.rewardId);
			expect(location?.id).toBe(reward?.locationId);
			expect(reward?.minimumTier).toBe("BRONZE");
			expect(claim.checkout?.paidAt ?? 0).toBeGreaterThan(claim.claimedAt);
			expect(claim.checkout?.paidAt ?? Infinity).toBeLessThanOrEqual(claim.claimExpiresAt);
			expect(claim.claimedAt).toBeGreaterThanOrEqual(reward?.startMs ?? Infinity);
			expect(claim.checkout?.paidAt ?? Infinity).toBeLessThanOrEqual(reward?.endMs ?? 0);
			expect(claim.checkout?.billTotalMinor ?? 0).toBeGreaterThanOrEqual(reward?.minSpendMinor ?? Infinity);
			expect(claim.checkout?.paidAt ?? Infinity).toBeLessThan(NOW);
		}
	});

	it("expires a claim only once its window has passed, with no bill", () => {
		const expired = network.claims.filter((claim) => claim.status === "EXPIRED");
		expect(expired.length).toBeGreaterThan(0);
		for (const claim of expired) {
			expect(claim.checkout).toBeNull();
			expect(claim.claimExpiresAt).toBeLessThan(NOW);
		}
	});

	it("brings each loyal customer back to five merchants enough to reach Diamond in the last 12 months", () => {
		const diamond = DEFAULT_TIER_RULES.diamondThreshold;
		for (const userId of LOYAL) {
			const redeemed = network.claims.filter((claim) => claim.userId === userId && claim.status === "REDEEMED" && (claim.checkout?.paidAt ?? 0) > NOW - YEAR_MS);
			const merchants = new Set(redeemed.map((claim) => rewardsByKey.get(claim.rewardKey)?.tenantId));
			expect(merchants.size).toBe(LOYAL_MERCHANT_COUNT);
			const counted = [...merchants].reduce(
				(total, tenantId) => total + Math.min(DEFAULT_TIER_RULES.perMerchantCap, redeemed.filter((claim) => rewardsByKey.get(claim.rewardKey)?.tenantId === tenantId).length),
				0,
			);
			expect(counted).toBe(LOYAL_MERCHANT_COUNT * LOYAL_VISITS_PER_MERCHANT);
			expect(counted).toBeGreaterThanOrEqual(diamond);
		}
	});

	it("keeps the other customers' visits away from the loyal ones' ids", () => {
		const others = network.claims.filter((claim) => claim.key.startsWith("general:"));
		expect(others.length).toBeGreaterThan(0);
		expect(others.every((claim) => !LOYAL.includes(claim.userId))).toBe(true);
	});

	it("names each owner after the merchant's slug, and each till after its branch", () => {
		for (const tenant of networkTenants()) {
			expect(tenant.ownerEmail).toBe(`owner@${tenant.slug}.demo`);
			for (const location of tenant.locations) {
				expect(location.terminalId).toBe(`${location.code.toUpperCase()}-TILL-01`);
			}
		}
	});
});
