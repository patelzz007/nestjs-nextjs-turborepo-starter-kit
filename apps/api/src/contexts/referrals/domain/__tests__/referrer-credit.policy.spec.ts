import { DAY_MS, epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { creditClaimExpiresAt, REFERRER_CLAIM_TTL_DAYS, REFERRER_CLAIM_TTL_MS } from "../policies/referrer-credit.policy";

const NOW = epochMs(1_800_000_000_000);

describe("creditClaimExpiresAt", () => {
	it("gives the credit claim the referrer TTL when the referrer reward outlives it", () => {
		expect(REFERRER_CLAIM_TTL_MS).toBe(REFERRER_CLAIM_TTL_DAYS * DAY_MS);
		expect(creditClaimExpiresAt(NOW, epochMs(NOW + REFERRER_CLAIM_TTL_MS + 1))).toBe(NOW + REFERRER_CLAIM_TTL_MS);
	});

	it("uses the TTL when the referrer reward expires exactly at its end", () => {
		expect(creditClaimExpiresAt(NOW, epochMs(NOW + REFERRER_CLAIM_TTL_MS))).toBe(NOW + REFERRER_CLAIM_TTL_MS);
	});

	it("never outlives the referrer reward that expires first", () => {
		expect(creditClaimExpiresAt(NOW, epochMs(NOW + REFERRER_CLAIM_TTL_MS - 1))).toBe(NOW + REFERRER_CLAIM_TTL_MS - 1);
		expect(creditClaimExpiresAt(NOW, NOW)).toBe(NOW);
	});
});
