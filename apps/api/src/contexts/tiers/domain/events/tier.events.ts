import type { CustomerTier, EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** A customer reached a higher tier (ADR 085). Their tier hold runs until `holdUntil`. */
export class CustomerTierPromoted extends DomainEvent {
	public readonly eventName = "tiers.CustomerTierPromoted";

	public constructor(
		occurredAt: EpochMs,
		public readonly userId: string,
		public readonly fromTier: CustomerTier,
		public readonly toTier: CustomerTier,
		public readonly holdUntil: EpochMs,
	) {
		super(occurredAt);
	}
}

/** A customer was warned that their tier falls to `toTier` at `dueAt` unless they redeem `redemptionsToKeep` more. */
export class CustomerTierDemotionWarned extends DomainEvent {
	public readonly eventName = "tiers.CustomerTierDemotionWarned";

	public constructor(
		occurredAt: EpochMs,
		public readonly userId: string,
		public readonly currentTier: CustomerTier,
		public readonly toTier: CustomerTier,
		public readonly dueAt: EpochMs,
		public readonly redemptionsToKeep: number,
	) {
		super(occurredAt);
	}
}

/** A customer's tier fell, after a warning and outside a tier hold. */
export class CustomerTierDemoted extends DomainEvent {
	public readonly eventName = "tiers.CustomerTierDemoted";

	public constructor(
		occurredAt: EpochMs,
		public readonly userId: string,
		public readonly fromTier: CustomerTier,
		public readonly toTier: CustomerTier,
	) {
		super(occurredAt);
	}
}

export type TierDomainEvent = CustomerTierPromoted | CustomerTierDemotionWarned | CustomerTierDemoted;
