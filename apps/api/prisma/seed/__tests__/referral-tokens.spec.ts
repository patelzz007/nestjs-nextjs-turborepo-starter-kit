import { RewardReferralAttributionTokenSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { seedAttributionToken } from "../referral-tokens";

describe("seedAttributionToken", () => {
	it("gives each seeded link a distinct token in the contract's shape, readable by its label", () => {
		const alice = seedAttributionToken("alice_bob_kl");
		const carol = seedAttributionToken("carol_user_mlk");

		expect(RewardReferralAttributionTokenSchema.safeParse(alice).success).toBe(true);
		expect(alice.startsWith("seed_alice_bob_kl")).toBe(true);
		expect(alice).not.toBe(carol);
	});

	it("refuses a label too long to stay a token", () => {
		expect(() => seedAttributionToken("x".repeat(40))).toThrow();
	});
});
