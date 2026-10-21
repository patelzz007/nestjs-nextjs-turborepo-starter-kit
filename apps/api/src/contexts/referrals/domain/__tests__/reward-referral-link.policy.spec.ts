import { DAY_MS, epochMs, REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS, REWARD_REFERRAL_OPEN_LINK_LIMIT } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { attributionExpiresAt, decideReferralAttribution, decideReferralLink } from "../policies/reward-referral-link.policy";

const LINK = { rewardId: "reward-1", referrerUserId: "referrer-1", refereeUserId: null };

describe("decideReferralLink", () => {
	it("mints a link for a referable reward below the cap", () => {
		expect(decideReferralLink({ rewardIsReferable: true, openLinks: 0 })).toBe("ok");
		expect(decideReferralLink({ rewardIsReferable: true, openLinks: REWARD_REFERRAL_OPEN_LINK_LIMIT - 1 })).toBe("ok");
	});

	it("refuses a reward that cannot be shared before looking at the cap", () => {
		expect(decideReferralLink({ rewardIsReferable: false, openLinks: REWARD_REFERRAL_OPEN_LINK_LIMIT })).toBe("not_referable");
	});

	it("refuses at the cap of unused links", () => {
		expect(decideReferralLink({ rewardIsReferable: true, openLinks: REWARD_REFERRAL_OPEN_LINK_LIMIT })).toBe("limit_reached");
	});
});

describe("decideReferralAttribution", () => {
	it("accepts an unused link of someone else, and the referee's own earlier attachment", () => {
		expect(decideReferralAttribution(LINK, "referee-1")).toBe("ok");
		expect(decideReferralAttribution({ ...LINK, refereeUserId: "referee-1" }, "referee-1")).toBe("ok");
	});

	it("answers an unknown link and one another referee used the same way", () => {
		expect(decideReferralAttribution(null, "referee-1")).toBe("invalid");
		expect(decideReferralAttribution({ ...LINK, refereeUserId: "someone-else" }, "referee-1")).toBe("invalid");
	});

	it("never lets a referrer refer themselves", () => {
		expect(decideReferralAttribution(LINK, "referrer-1")).toBe("own_link");
	});
});

describe("attributionExpiresAt", () => {
	it("keeps the attribution for the shared window", () => {
		const now = epochMs(1_800_000_000_000);

		expect(attributionExpiresAt(now)).toBe(now + REWARD_REFERRAL_ATTRIBUTION_TTL_DAYS * DAY_MS);
	});
});
