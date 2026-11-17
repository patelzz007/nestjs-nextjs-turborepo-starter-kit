import { Command } from "@nestjs/cqrs";
import type { CustomerTier } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/**
 * Re-evaluate one customer's tier just after their redemption committed (ADR 085): a promotion within seconds, and a
 * warning they no longer need withdrawn. Answers the tier afterwards, or null when tiers are off (nothing evaluated).
 */
export class EvaluateCustomerTierCommand extends Command<CustomerTier | null> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly userId: string,
	) {
		super();
	}
}
