import { DAY_MS, epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RewardReferral } from "../aggregates/reward-referral.aggregate";
import { ReferrerCredited } from "../events/referral.events";
import { creditClaimExpiresAt, REFERRER_CLAIM_TTL_DAYS, REFERRER_CLAIM_TTL_MS } from "../policies/referrer-credit.policy";

const NOW = epochMs(1_792_195_200_000);
const FAR_FUTURE = epochMs(NOW + 365 * DAY_MS);

function pending(): RewardReferral {
	return RewardReferral.pending({ id: "referral-1", rewardId: "reward-1", referrerUserId: "referrer-1", refereeUserId: "referee-1" });
}

describe("creditClaimExpiresAt", () => {
	it("gives the referrer the TTL, never past the referrer reward's own expiry", () => {
		expect(REFERRER_CLAIM_TTL_MS).toBe(REFERRER_CLAIM_TTL_DAYS * DAY_MS);
		expect(creditClaimExpiresAt(NOW, FAR_FUTURE)).toBe(NOW + REFERRER_CLAIM_TTL_MS);
		expect(creditClaimExpiresAt(NOW, epochMs(NOW + DAY_MS))).toBe(NOW + DAY_MS);
	});
});

describe("RewardReferral.credit", () => {
	it("moves PENDING → CREDITED once, recording ReferrerCredited with the bonus and the credit claim's expiry", () => {
		const referral = pending();

		referral.credit({ referrerRewardId: "bonus-1", title: "Free cake", expiryDate: FAR_FUTURE }, NOW);

		expect(referral.creditedAtTime).toBe(NOW);
		expect(referral.pullEvents()).toEqual([
			new ReferrerCredited(NOW, "referral-1", "referrer-1", "bonus-1", "Free cake", epochMs(NOW + REFERRER_CLAIM_TTL_MS), REFERRER_CLAIM_TTL_DAYS),
		]);
	});

	it("credits nothing twice", () => {
		const referral = pending();
		referral.credit({ referrerRewardId: "bonus-1", title: "Free cake", expiryDate: FAR_FUTURE }, NOW);
		referral.pullEvents();

		referral.credit({ referrerRewardId: "bonus-1", title: "Free cake", expiryDate: FAR_FUTURE }, epochMs(NOW + 1));

		expect(referral.creditedAtTime).toBe(NOW);
		expect(referral.pullEvents()).toEqual([]);
	});

	it("is PENDING until credited", () => {
		expect(pending().creditedAtTime).toBeNull();
		expect(pending().id).toBe("referral-1");
		expect(pending().rewardId).toBe("reward-1");
	});
});
