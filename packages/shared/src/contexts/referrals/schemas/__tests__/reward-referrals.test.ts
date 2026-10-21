import { describe, expect, it } from "vitest";

import { RewardReferralAttributionSchema, RewardReferralAttributionTokenSchema } from "../reward-referrals";

/** 43 base64url characters: what 32 random bytes encode to. */
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

describe("reward referral link tokens", () => {
	it("accepts exactly 43 base64url characters", () => {
		expect(TOKEN).toHaveLength(43);
		expect(RewardReferralAttributionTokenSchema.safeParse(TOKEN).success).toBe(true);
	});

	it("refuses a token of another length or alphabet", () => {
		expect(RewardReferralAttributionTokenSchema.safeParse(TOKEN.slice(1)).success).toBe(false);
		expect(RewardReferralAttributionTokenSchema.safeParse(`${TOKEN}a`).success).toBe(false);
		expect(RewardReferralAttributionTokenSchema.safeParse(`${TOKEN.slice(1)}+`).success).toBe(false);
		expect(RewardReferralAttributionTokenSchema.safeParse(`${TOKEN.slice(1)}=`).success).toBe(false);
	});

	it("takes the token and nothing else in the attribution body", () => {
		expect(RewardReferralAttributionSchema.safeParse({ attributionToken: TOKEN }).success).toBe(true);
		expect(RewardReferralAttributionSchema.safeParse({ attributionToken: TOKEN, refereeUserId: "someone" }).success).toBe(false);
	});
});
