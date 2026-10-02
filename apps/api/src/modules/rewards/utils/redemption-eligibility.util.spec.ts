import { describe, expect, it } from "vitest";

import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { checkoutRequestHash, isRewardValidAtStore, minSpendMinorFromRules, redemptionInvalidReason } from "./redemption-eligibility.util";

const NOW = 1_790_000_000_000;
const HOUR_MS = 3_600_000;
const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const STORE_B = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";

function lookup(
	overrides: { readonly claim?: Partial<RewardClaimRedemptionLookup["claim"]>; readonly reward?: Partial<RewardClaimRedemptionLookup["reward"]> } = {},
): RewardClaimRedemptionLookup {
	return {
		claim: {
			id: "claim-1",
			userId: "user-1",
			rewardId: "reward-1",
			status: "PENDING",
			claimExpiresAt: BigInt(NOW + HOUR_MS),
			redemptionTokenHash: "hash",
			backupFailedAttempts: 0,
			backupLockedUntil: null,
			...overrides.claim,
		},
		reward: {
			id: "reward-1",
			organizationId: "org-1",
			title: "Free latte",
			rewardType: "FREE_ITEM",
			expiryDate: BigInt(NOW + HOUR_MS),
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
			minSpendMinor: null,
			...overrides.reward,
		},
	};
}

describe("minSpendMinorFromRules", () => {
	it("converts ringgit (including fractions) to sen", () => {
		expect(minSpendMinorFromRules({ minSpendMyr: 20 })).toBe(2000);
		expect(minSpendMinorFromRules({ minSpendMyr: 12.5 })).toBe(1250);
	});

	it("is null without a (valid) minimum", () => {
		expect(minSpendMinorFromRules(null)).toBeNull();
		expect(minSpendMinorFromRules({ maxUsePerUser: 1 })).toBeNull();
		expect(minSpendMinorFromRules({ minSpendMyr: -1 })).toBeNull();
	});
});

describe("isRewardValidAtStore", () => {
	it("accepts any store for organization-wide rewards", () => {
		expect(isRewardValidAtStore({ locationScopeType: "ALL_LOCATIONS", locationIds: [] }, STORE_B)).toBe(true);
	});

	it("limits store-scoped rewards to their stores", () => {
		const reward = { locationScopeType: "SELECTED", locationIds: [STORE_A] } satisfies Pick<RewardClaimRedemptionLookup["reward"], "locationScopeType" | "locationIds">;

		expect(isRewardValidAtStore(reward, STORE_A)).toBe(true);
		expect(isRewardValidAtStore(reward, STORE_B)).toBe(false);
	});

	it("does not refuse when the POS store is unknown (nothing to narrow against)", () => {
		expect(isRewardValidAtStore({ locationScopeType: "SELECTED", locationIds: [STORE_A] }, null)).toBe(true);
	});
});

describe("redemptionInvalidReason", () => {
	const base = { locationId: STORE_A, usedBackupCode: false, now: NOW };

	it("is null for a pending, unexpired claim valid at this store", () => {
		expect(redemptionInvalidReason({ ...base, lookup: lookup() })).toBeNull();
	});

	it("reports redeemed, expired (by status or time), locked backup codes and the wrong store", () => {
		expect(redemptionInvalidReason({ ...base, lookup: lookup({ claim: { status: "REDEEMED" } }) })).toBe("ALREADY_REDEEMED");
		expect(redemptionInvalidReason({ ...base, lookup: lookup({ claim: { status: "EXPIRED" } }) })).toBe("EXPIRED");
		expect(redemptionInvalidReason({ ...base, lookup: lookup({ claim: { claimExpiresAt: BigInt(NOW - 1) } }) })).toBe("EXPIRED");
		expect(redemptionInvalidReason({ ...base, usedBackupCode: true, lookup: lookup({ claim: { backupLockedUntil: BigInt(NOW + HOUR_MS) } }) })).toBe("BACKUP_LOCKED");
		expect(redemptionInvalidReason({ ...base, lookup: lookup({ reward: { locationScopeType: "SELECTED", locationIds: [STORE_B] } }) })).toBe("NOT_VALID_AT_STORE");
	});

	it("ignores a backup lock when the customer showed the QR instead", () => {
		expect(redemptionInvalidReason({ ...base, lookup: lookup({ claim: { backupLockedUntil: BigInt(NOW + HOUR_MS) } }) })).toBeNull();
	});
});

describe("checkoutRequestHash", () => {
	const input = { idempotencyKey: "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a", billTotalMinor: 2500, currency: "MYR", codes: [{ token: "t".repeat(32) }] } satisfies Parameters<
		typeof checkoutRequestHash
	>[0];

	it("is stable for the same bill and codes, whatever the idempotency key", () => {
		expect(checkoutRequestHash(input)).toBe(checkoutRequestHash({ ...input, idempotencyKey: "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b" }));
	});

	it("changes when the bill or the codes change", () => {
		expect(checkoutRequestHash({ ...input, billTotalMinor: 2501 })).not.toBe(checkoutRequestHash(input));
		expect(checkoutRequestHash({ ...input, codes: [{ backupCode: "ABCD2345" }] })).not.toBe(checkoutRequestHash(input));
	});
});
