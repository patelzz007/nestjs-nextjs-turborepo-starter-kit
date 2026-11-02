import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ClaimRedeemed, RewardClaimed } from "../../domain/events/claim.events";
import { RecordTenantCustomerOnClaimRedeemed, RecordTenantCustomerOnRewardClaimed } from "../event-handlers/in-transaction/record-tenant-customer.in-transaction-handlers";
import { InMemoryClaimsStore, NOW } from "./fakes/claims.fakes";

const FACTS = { claimId: "claim-1", userId: "user-1", rewardId: "reward-1", isReferrerCredit: false };
const DAY_MS = 86_400_000;

describe("tenant-customer links (ADR 073)", () => {
	it("links the claimant to the reward's tenant on the first claim, and counts later claims", async () => {
		const store = new InMemoryClaimsStore();
		const handler = new RecordTenantCustomerOnRewardClaimed();

		await handler.handle(new RewardClaimed(NOW, FACTS), store.scope);
		await handler.handle(new RewardClaimed(epochMs(NOW + DAY_MS), { ...FACTS, claimId: "claim-2" }), store.scope);

		expect(store.tenantCustomers.rows.get("org-1:user-1")).toEqual({
			tenantId: "org-1",
			userId: "user-1",
			firstClaimedAt: NOW,
			lastClaimedAt: NOW + DAY_MS,
			claimCount: 2,
			lastRedeemedAt: null,
			leftAt: null,
		});
	});

	it("brings back a customer who had left the tenant when they claim again", async () => {
		const store = new InMemoryClaimsStore();
		await new RecordTenantCustomerOnRewardClaimed().handle(new RewardClaimed(NOW, FACTS), store.scope);
		const existing = store.tenantCustomers.rows.get("org-1:user-1");
		if (existing === undefined) {
			throw new Error("Expected a link");
		}
		store.tenantCustomers.rows.set("org-1:user-1", { ...existing, leftAt: NOW });

		await new RecordTenantCustomerOnRewardClaimed().handle(new RewardClaimed(epochMs(NOW + 1), FACTS), store.scope);

		expect(store.tenantCustomers.rows.get("org-1:user-1")?.leftAt).toBeNull();
	});

	it("stamps the redemption on the link, and links nobody for a reward it does not know", async () => {
		const store = new InMemoryClaimsStore();
		await new RecordTenantCustomerOnRewardClaimed().handle(new RewardClaimed(NOW, FACTS), store.scope);

		await new RecordTenantCustomerOnClaimRedeemed().handle(new ClaimRedeemed(epochMs(NOW + DAY_MS), FACTS), store.scope);
		await new RecordTenantCustomerOnRewardClaimed().handle(new RewardClaimed(NOW, { ...FACTS, rewardId: "unknown-reward", userId: "user-2" }), store.scope);

		expect(store.tenantCustomers.rows.get("org-1:user-1")?.lastRedeemedAt).toBe(NOW + DAY_MS);
		expect(store.tenantCustomers.rows.size).toBe(1);
	});
});
