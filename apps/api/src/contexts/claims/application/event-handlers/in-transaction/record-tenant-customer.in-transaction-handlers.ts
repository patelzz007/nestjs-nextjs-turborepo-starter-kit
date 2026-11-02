import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import { ClaimRedeemed, RewardClaimed } from "../../../domain/events/claim.events";
import type { ClaimsScope } from "../../claims-scope";

/**
 * A claim makes the claimant the reward's tenant's customer (ADR 073), in the claim's own transaction —
 * a referrer's credit claim included. A claimant who had left the tenant is back.
 */
export class RecordTenantCustomerOnRewardClaimed implements InTransactionEventHandler<RewardClaimed, ClaimsScope> {
	public accepts(event: DomainEvent): event is RewardClaimed {
		return event instanceof RewardClaimed;
	}

	public async handle(event: RewardClaimed, scope: ClaimsScope): Promise<void> {
		const reward = await scope.rewardFacts.factsFor(event.rewardId);
		if (reward !== null) {
			await scope.tenantCustomers.recordClaim(reward.tenantId, event.userId, event.occurredAt);
		}
	}
}

/** A redemption stamps the customer's link, in the checkout's own transaction. */
export class RecordTenantCustomerOnClaimRedeemed implements InTransactionEventHandler<ClaimRedeemed, ClaimsScope> {
	public accepts(event: DomainEvent): event is ClaimRedeemed {
		return event instanceof ClaimRedeemed;
	}

	public async handle(event: ClaimRedeemed, scope: ClaimsScope): Promise<void> {
		const reward = await scope.rewardFacts.factsFor(event.rewardId);
		if (reward !== null) {
			await scope.tenantCustomers.recordRedemption(reward.tenantId, event.userId, event.occurredAt);
		}
	}
}
