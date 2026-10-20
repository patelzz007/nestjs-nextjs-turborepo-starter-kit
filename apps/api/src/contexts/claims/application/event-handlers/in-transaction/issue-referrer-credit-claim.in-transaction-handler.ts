import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import { ReferrerCredited } from "../../../../referrals/public-api";
import { RewardClaim } from "../../../domain/aggregates/reward-claim.aggregate";
import type { ClaimsScope } from "../../claims-scope";
import type { ClaimCodesPort } from "../../ports/claim-codes.port";
import type { ClaimIdGenerator } from "../../ports/claims.tokens";

/**
 * A referee's redemption credited the referrer: their credit claim is issued in the checkout's own
 * transaction, so a sale never credits without the claim. The unit it holds was taken from the
 * referrer reward by the credit; the plaintext codes are re-issued when the referrer opens the QR.
 */
export class IssueReferrerCreditClaimOnReferrerCredited implements InTransactionEventHandler<ReferrerCredited, ClaimsScope> {
	public constructor(
		private readonly codes: ClaimCodesPort,
		private readonly ids: ClaimIdGenerator,
	) {}

	public accepts(event: DomainEvent): event is ReferrerCredited {
		return event instanceof ReferrerCredited;
	}

	public async handle(event: ReferrerCredited, scope: ClaimsScope): Promise<void> {
		const claim = RewardClaim.createReferrerCredit(
			{
				id: this.ids.next(),
				referrerUserId: event.referrerUserId,
				referrerRewardId: event.referrerRewardId,
				referralId: event.referralId,
				codes: this.codes.issueClaimCodes().hashes,
				claimExpiresAt: event.creditClaimExpiresAt,
			},
			event.occurredAt,
		);
		await scope.claims.add(claim);
		scope.events.collectFrom(claim);
	}
}
