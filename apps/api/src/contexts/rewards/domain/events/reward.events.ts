import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** Facts every reward event carries: which reward, whose, and its title at the time. */
export interface RewardEventFacts {
	readonly rewardId: string;
	readonly tenantId: string;
	readonly title: string;
}

export abstract class RewardDomainEvent extends DomainEvent {
	public readonly rewardId: string;
	public readonly tenantId: string;
	public readonly title: string;

	protected constructor(occurredAt: EpochMs, facts: RewardEventFacts) {
		super(occurredAt);
		this.rewardId = facts.rewardId;
		this.tenantId = facts.tenantId;
		this.title = facts.title;
	}
}

export class RewardCreated extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardCreated";

	public constructor(
		occurredAt: EpochMs,
		facts: RewardEventFacts,
		/** The referrer child created with it, or null. */
		public readonly referrerRewardId: string | null,
	) {
		super(occurredAt, facts);
	}
}

export class RewardRevised extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardRevised";

	public constructor(occurredAt: EpochMs, facts: RewardEventFacts) {
		super(occurredAt, facts);
	}
}

export class RewardSubmittedForReview extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardSubmittedForReview";

	public constructor(occurredAt: EpochMs, facts: RewardEventFacts) {
		super(occurredAt, facts);
	}
}

/** A reviewer published a pending reward. */
export class RewardApproved extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardApproved";

	public constructor(
		occurredAt: EpochMs,
		facts: RewardEventFacts,
		public readonly reviewerUserId: string,
	) {
		super(occurredAt, facts);
	}
}

/** A reviewer sent a pending reward back to draft. */
export class RewardRejected extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardRejected";

	public constructor(
		occurredAt: EpochMs,
		facts: RewardEventFacts,
		public readonly reviewerUserId: string,
		/** The reviewer's note to the merchant (always given). */
		public readonly reason: string,
	) {
		super(occurredAt, facts);
	}
}

/** The review window elapsed and the reward published itself. */
export class RewardAutoPublished extends RewardDomainEvent {
	public readonly eventName = "rewards.RewardAutoPublished";

	public constructor(occurredAt: EpochMs, facts: RewardEventFacts) {
		super(occurredAt, facts);
	}
}
