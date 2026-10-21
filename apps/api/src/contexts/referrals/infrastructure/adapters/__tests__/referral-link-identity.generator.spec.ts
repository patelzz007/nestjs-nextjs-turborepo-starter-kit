import { RewardReferralAttributionTokenSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CryptoReferralLinkIdentityGenerator } from "../referral-link-identity.generator";

/** Enough draws to catch a repeating or constant generator. */
const DRAWS = 50;

describe("CryptoReferralLinkIdentityGenerator", () => {
	it("mints a UUID row id and a contract-valid token, different every time", () => {
		const generator = new CryptoReferralLinkIdentityGenerator();
		const identities = Array.from({ length: DRAWS }, () => generator.next());

		for (const identity of identities) {
			expect(z.uuid().safeParse(identity.referralId).success).toBe(true);
			expect(RewardReferralAttributionTokenSchema.safeParse(identity.attributionToken).success).toBe(true);
		}
		expect(new Set(identities.map((identity) => identity.attributionToken)).size).toBe(DRAWS);
		expect(new Set(identities.map((identity) => identity.referralId)).size).toBe(DRAWS);
	});
});
