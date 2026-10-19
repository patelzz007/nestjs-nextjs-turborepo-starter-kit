import type { EpochMs } from "@workspace/shared";

export abstract class DomainEvent {
	/** "<context>.<PastTenseName>", e.g. "rewards.RewardPublished". Unique across the app. */
	public abstract readonly eventName: string;

	protected constructor(public readonly occurredAt: EpochMs) {}
}
