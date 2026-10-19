import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** Facts every claim event carries. */
export interface ClaimEventFacts {
	readonly claimId: string;
	readonly userId: string;
	readonly rewardId: string;
	readonly isReferrerCredit: boolean;
}

export abstract class ClaimDomainEvent extends DomainEvent {
	public readonly claimId: string;
	public readonly userId: string;
	public readonly rewardId: string;
	public readonly isReferrerCredit: boolean;

	protected constructor(occurredAt: EpochMs, facts: ClaimEventFacts) {
		super(occurredAt);
		this.claimId = facts.claimId;
		this.userId = facts.userId;
		this.rewardId = facts.rewardId;
		this.isReferrerCredit = facts.isReferrerCredit;
	}
}

export class RewardClaimed extends ClaimDomainEvent {
	public readonly eventName = "claims.RewardClaimed";

	public constructor(occurredAt: EpochMs, facts: ClaimEventFacts) {
		super(occurredAt, facts);
	}
}

/** Fresh QR and backup codes replaced the old ones (the old codes stop working). */
export class ClaimCodesIssued extends ClaimDomainEvent {
	public readonly eventName = "claims.ClaimCodesIssued";

	public constructor(occurredAt: EpochMs, facts: ClaimEventFacts) {
		super(occurredAt, facts);
	}
}

/** A pending claim ran out of time; its unit goes back to the reward. */
export class ClaimExpired extends ClaimDomainEvent {
	public readonly eventName = "claims.ClaimExpired";

	public constructor(
		occurredAt: EpochMs,
		facts: ClaimEventFacts,
		/** The reward's organization, for the analytics event. */
		public readonly organizationId: string,
	) {
		super(occurredAt, facts);
	}
}

export class ClaimRedeemed extends ClaimDomainEvent {
	public readonly eventName = "claims.ClaimRedeemed";

	public constructor(occurredAt: EpochMs, facts: ClaimEventFacts) {
		super(occurredAt, facts);
	}
}
