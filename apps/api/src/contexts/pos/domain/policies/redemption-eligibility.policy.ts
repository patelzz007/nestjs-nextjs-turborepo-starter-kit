import type { EpochMs, OrganizationLocationScopeType, RedemptionInvalidReason } from "@workspace/shared";

/** Where a reward may be redeemed, given the store of the POS request. */
export type StoreEligibility = "VALID" | "NOT_VALID_AT_STORE" | "STORE_REQUIRED";

/** The claim and reward facts a POS decision reads (from claims' `ClaimRedemptionPort`). */
export interface RedeemableClaim {
	readonly claimId: string;
	readonly customerUserId: string;
	readonly claimStatus: "PENDING" | "REDEEMED" | "EXPIRED";
	readonly claimExpiresAt: EpochMs;
	readonly rewardId: string;
	readonly rewardTitle: string;
	readonly locationScopeType: OrganizationLocationScopeType;
	/** The stores a `SELECTED`-scope reward is valid at (empty for `ALL_LOCATIONS`). */
	readonly locationIds: readonly string[];
	/** Minimum bill in minor units; `null` = no minimum. */
	readonly minSpendMinor: number | null;
}

/**
 * Whether a reward may be redeemed at the store a POS request comes from. `locationId === null` means
 * the store is unknown (an organization-wide key on a terminal never registered to a store): a
 * store-limited reward then FAILS CLOSED with `STORE_REQUIRED`, since nothing proves the redemption
 * happens at one of its stores.
 */
export function storeEligibility(claim: Pick<RedeemableClaim, "locationScopeType" | "locationIds">, locationId: string | null): StoreEligibility {
	if (claim.locationScopeType === "ALL_LOCATIONS") {
		return "VALID";
	}
	if (locationId === null) {
		return "STORE_REQUIRED";
	}
	return claim.locationIds.includes(locationId) ? "VALID" : "NOT_VALID_AT_STORE";
}

/**
 * Why the claim cannot be redeemed now, or `null` when it can. Merchant ownership is not a reason:
 * another merchant's code is never found (the lookup is scoped to the calling merchant).
 */
export function redemptionInvalidReason(claim: RedeemableClaim, locationId: string | null, now: EpochMs): RedemptionInvalidReason | null {
	if (claim.claimStatus === "REDEEMED") {
		return "ALREADY_REDEEMED";
	}
	if (claim.claimStatus === "EXPIRED" || claim.claimExpiresAt < now) {
		return "EXPIRED";
	}
	const store: StoreEligibility = storeEligibility(claim, locationId);
	return store === "VALID" ? null : store;
}
