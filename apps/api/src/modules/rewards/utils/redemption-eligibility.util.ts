import type { RedemptionCheckoutInput, RedemptionInvalidReason } from "@workspace/shared";

import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { sha256Hex } from "../../../common/crypto/sha256";

/** Where a reward may be redeemed, given the store of the POS request. */
export type StoreEligibility = "VALID" | "NOT_VALID_AT_STORE" | "STORE_REQUIRED";

/**
 * Whether a reward may be redeemed at the store a POS request comes from.
 * `locationId === null` means the store is unknown (an organization-wide key
 * on a terminal that was never registered to a store). A store-limited reward
 * then FAILS CLOSED with `STORE_REQUIRED`: without a store there is no way to
 * prove the redemption happens at one of the reward's stores.
 */
export function storeEligibility(reward: Pick<RewardClaimRedemptionLookup["reward"], "locationScopeType" | "locationIds">, locationId: string | null): StoreEligibility {
	if (reward.locationScopeType === "ALL_LOCATIONS") {
		return "VALID";
	}
	if (locationId === null) {
		return "STORE_REQUIRED";
	}
	return reward.locationIds.includes(locationId) ? "VALID" : "NOT_VALID_AT_STORE";
}

export interface RedemptionEligibilityInput {
	readonly lookup: RewardClaimRedemptionLookup;
	/** The store of the POS request (`null` = unknown). */
	readonly locationId: string | null;
	readonly now: number;
}

/**
 * Why the claim cannot be redeemed now, or `null` when it can. Merchant
 * ownership is not a reason: a code of another merchant is never found
 * (the lookup is scoped to the calling merchant).
 */
export function redemptionInvalidReason({ lookup, locationId, now }: RedemptionEligibilityInput): RedemptionInvalidReason | null {
	const { claim, reward } = lookup;
	if (claim.status === "REDEEMED") {
		return "ALREADY_REDEEMED";
	}
	if (claim.status === "EXPIRED" || Number(claim.claimExpiresAt) < now) {
		return "EXPIRED";
	}
	const store = storeEligibility(reward, locationId);
	return store === "VALID" ? null : store;
}

/**
 * Fingerprint of a checkout's payload: a retried idempotency key must carry
 * the same bill and codes to be replayed (codes are hashed, never stored).
 */
export function checkoutRequestHash(input: RedemptionCheckoutInput): string {
	const canonical = JSON.stringify({
		billTotalMinor: input.billTotalMinor,
		currency: input.currency,
		codes: input.codes.map((code) => ({ token: code.token ?? null, backupCode: code.backupCode ?? null })),
	});
	return sha256Hex(canonical);
}
