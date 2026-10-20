import { epochMs, type EpochMs } from "@workspace/shared";

import type { CheckoutPoint, NewSale, PresentedClaim } from "../aggregates/reward-sale.aggregate";
import type { RedeemableClaim } from "../policies/redemption-eligibility.policy";

/** A fixed instant every pos domain test measures from. */
export const NOW: EpochMs = epochMs(1_792_195_200_000);

export const TENANT_ID = "org-1";
export const STORE_A = "store-a";
export const STORE_B = "store-b";
export const CUSTOMER = "customer-1";

/** One hour, the expiry the fixture claims get unless a test says otherwise. */
const HOUR_MS = 3_600_000;

export function redeemableClaim(patch: Partial<RedeemableClaim> = {}): RedeemableClaim {
	return {
		claimId: "claim-1",
		customerUserId: CUSTOMER,
		claimStatus: "PENDING",
		claimExpiresAt: epochMs(NOW + HOUR_MS),
		rewardId: "reward-1",
		rewardTitle: "Free latte",
		locationScopeType: "ALL_LOCATIONS",
		locationIds: [],
		minSpendMinor: null,
		...patch,
	};
}

export function presented(patch: Partial<RedeemableClaim> = {}, method: PresentedClaim["method"] = "SCAN"): PresentedClaim {
	return { claim: redeemableClaim(patch), method };
}

export const POINT: CheckoutPoint = { tenantId: TENANT_ID, locationId: STORE_A, terminalId: "TERM-AAAA2222", apiKeyId: "key-1" };

export function newSale(presentedClaims: readonly PresentedClaim[], patch: Partial<NewSale> = {}): NewSale {
	return {
		id: "sale-1",
		point: POINT,
		billTotalMinor: 5_000,
		currency: "MYR",
		idempotencyKey: "idem-1",
		requestHash: "hash-1",
		presented: presentedClaims,
		...patch,
	};
}
