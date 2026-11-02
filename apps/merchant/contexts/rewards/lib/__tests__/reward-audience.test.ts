import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { describeRewardAudience, toRewardCustomerOption } from "@/contexts/rewards/lib/reward-audience";

const LAST_CLAIM = epochMs(Date.UTC(2026, 9, 28, 12));

describe("toRewardCustomerOption", () => {
	it("shows the name, masked email and claim history", () => {
		expect(toRewardCustomerOption({ userId: "u1", fullName: "Alice", maskedEmail: "a•••@x.com", lastClaimedAt: LAST_CLAIM, claimCount: 3 })).toEqual({
			userId: "u1",
			fullName: "Alice",
			maskedEmail: "a•••@x.com",
			detail: "Claimed 3 times · last 28 Oct 2026",
			unavailableReason: null,
		});
	});

	it("says once for a single claim", () => {
		expect(toRewardCustomerOption({ userId: "u1", fullName: "Alice", maskedEmail: null, lastClaimedAt: LAST_CLAIM, claimCount: 1 }).detail).toMatch(/^Claimed once/u);
	});
});

describe("describeRewardAudience", () => {
	it("names everyone or counts the chosen customers", () => {
		expect(describeRewardAudience("EVERYONE", 0)).toBe("Everyone");
		expect(describeRewardAudience("SELECTED_CUSTOMERS", 1)).toBe("1 chosen customer");
		expect(describeRewardAudience("SELECTED_CUSTOMERS", 4)).toBe("4 chosen customers");
	});
});
