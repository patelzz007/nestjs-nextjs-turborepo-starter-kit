import { describe, expect, it } from "vitest";

import { AdminRejectRewardSchema, REWARD_REJECTION_REASON_MAX_LENGTH } from "../reward";

// Rejecting a reward must always tell the merchant why (decision #74): the
// reason is required, trimmed, non-empty, and bounded.
describe("AdminRejectRewardSchema", () => {
	it("accepts a reason and trims it", () => {
		expect(AdminRejectRewardSchema.parse({ reason: "  Use a photo of the actual latte.  " })).toEqual({ reason: "Use a photo of the actual latte." });
	});

	it("rejects a missing reason", () => {
		expect(AdminRejectRewardSchema.safeParse({}).success).toBe(false);
	});

	it.each(["", " ", "\n\t "])("rejects a blank reason %j", (reason) => {
		expect(AdminRejectRewardSchema.safeParse({ reason }).success).toBe(false);
	});

	it("accepts a reason at the maximum length and rejects one past it", () => {
		expect(AdminRejectRewardSchema.safeParse({ reason: "x".repeat(REWARD_REJECTION_REASON_MAX_LENGTH) }).success).toBe(true);
		expect(AdminRejectRewardSchema.safeParse({ reason: "x".repeat(REWARD_REJECTION_REASON_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("rejects unknown keys", () => {
		expect(AdminRejectRewardSchema.safeParse({ reason: "ok", note: "extra" }).success).toBe(false);
	});
});
