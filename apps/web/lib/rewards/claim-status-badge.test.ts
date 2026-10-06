import { RewardClaimStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { claimStatusBadge } from "./claim-status-badge";
import { CLAIM_STATUS_DISPLAY } from "./customer-analytics";

describe("claimStatusBadge", () => {
	it("tones a claim that can still be redeemed as success, and finished claims neutrally", () => {
		expect(claimStatusBadge("PENDING").tone).toBe("success");
		expect(claimStatusBadge("REDEEMED").tone).toBe("neutral");
		expect(claimStatusBadge("EXPIRED").tone).toBe("muted");
	});

	it("labels every status with the shared claim-status vocabulary, never the raw enum value", () => {
		for (const status of RewardClaimStatusSchema.options) {
			expect(claimStatusBadge(status).label).toBe(CLAIM_STATUS_DISPLAY[status].label);
			expect(claimStatusBadge(status).label).not.toBe(status);
		}
	});
});
