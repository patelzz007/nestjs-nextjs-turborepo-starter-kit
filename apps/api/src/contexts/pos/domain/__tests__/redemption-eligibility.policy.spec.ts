import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { redemptionInvalidReason, storeEligibility } from "../policies/redemption-eligibility.policy";
import { NOW, redeemableClaim, STORE_A, STORE_B } from "./pos-domain.fixture";

describe("storeEligibility", () => {
	it("accepts a tenant-wide reward at any store, even an unknown one", () => {
		expect(storeEligibility({ locationScopeType: "ALL_LOCATIONS", locationIds: [] }, null)).toBe("VALID");
		expect(storeEligibility({ locationScopeType: "ALL_LOCATIONS", locationIds: [] }, STORE_B)).toBe("VALID");
	});

	it("accepts a store-limited reward only at one of its stores", () => {
		expect(storeEligibility({ locationScopeType: "SELECTED", locationIds: [STORE_A] }, STORE_A)).toBe("VALID");
		expect(storeEligibility({ locationScopeType: "SELECTED", locationIds: [STORE_A] }, STORE_B)).toBe("NOT_VALID_AT_STORE");
	});

	it("fails closed for a store-limited reward when the store is unknown", () => {
		expect(storeEligibility({ locationScopeType: "SELECTED", locationIds: [STORE_A] }, null)).toBe("STORE_REQUIRED");
	});
});

describe("redemptionInvalidReason", () => {
	it("is null for a pending, unexpired claim valid at the store", () => {
		expect(redemptionInvalidReason(redeemableClaim(), STORE_A, NOW)).toBeNull();
	});

	it("accepts a claim expiring exactly now and refuses one a millisecond past", () => {
		expect(redemptionInvalidReason(redeemableClaim({ claimExpiresAt: NOW }), STORE_A, NOW)).toBeNull();
		expect(redemptionInvalidReason(redeemableClaim({ claimExpiresAt: epochMs(NOW - 1) }), STORE_A, NOW)).toBe("EXPIRED");
		expect(redemptionInvalidReason(redeemableClaim({ claimExpiresAt: epochMs(NOW + 1) }), STORE_A, NOW)).toBeNull();
	});

	it("refuses a customer the merchant banned, after a redemption or an expiry but before the store", () => {
		expect(redemptionInvalidReason(redeemableClaim({ customerBanned: true }), STORE_A, NOW)).toBe("CUSTOMER_BANNED");
		expect(redemptionInvalidReason(redeemableClaim({ customerBanned: true, locationScopeType: "SELECTED", locationIds: [STORE_B] }), STORE_A, NOW)).toBe("CUSTOMER_BANNED");
		expect(redemptionInvalidReason(redeemableClaim({ customerBanned: true, claimStatus: "REDEEMED" }), STORE_A, NOW)).toBe("ALREADY_REDEEMED");
		expect(redemptionInvalidReason(redeemableClaim({ customerBanned: true, claimExpiresAt: epochMs(NOW - 1) }), STORE_A, NOW)).toBe("EXPIRED");
	});

	it("names a redemption before an expiry, and an expiry before the store", () => {
		expect(redemptionInvalidReason(redeemableClaim({ claimStatus: "REDEEMED", claimExpiresAt: epochMs(NOW - 1) }), STORE_A, NOW)).toBe("ALREADY_REDEEMED");
		expect(redemptionInvalidReason(redeemableClaim({ claimStatus: "EXPIRED", locationScopeType: "SELECTED", locationIds: [STORE_B] }), STORE_A, NOW)).toBe("EXPIRED");
		expect(redemptionInvalidReason(redeemableClaim({ locationScopeType: "SELECTED", locationIds: [STORE_B] }), null, NOW)).toBe("STORE_REQUIRED");
	});
});
