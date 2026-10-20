import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ClaimExpired, ClaimRedeemed } from "../../../domain/events/claim.events";
import { ClaimsIntegrationEventsMapper } from "../claims-integration-events.mapper";

const NOW = epochMs(1_800_000_000_000);
const CLAIM_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const TENANT_ID = "33333333-3333-4333-8333-333333333333";
const FACTS = { claimId: CLAIM_ID, userId: USER_ID, rewardId: "44444444-4444-4444-8444-444444444444", isReferrerCredit: true };

describe("ClaimsIntegrationEventsMapper", () => {
	it("records an expired claim on the reward.platform stream, as the legacy job did", () => {
		expect(new ClaimsIntegrationEventsMapper().map(new ClaimExpired(NOW, FACTS, TENANT_ID))).toEqual({
			type: "reward.platform",
			payload: { event: "reward.claim_expired", actorUserId: USER_ID, tenantId: TENANT_ID, metadata: { claimId: CLAIM_ID, isReferrerCredit: true } },
		});
	});

	it("records nothing for other claim events", () => {
		expect(new ClaimsIntegrationEventsMapper().map(new ClaimRedeemed(NOW, FACTS))).toBeNull();
	});
});
