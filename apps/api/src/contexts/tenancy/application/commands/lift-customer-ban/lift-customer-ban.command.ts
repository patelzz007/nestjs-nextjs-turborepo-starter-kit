import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface LiftCustomerBanInput {
	readonly tenantSlug: string;
	readonly banId: string;
}

/** A merchant lifts one of its customer bans. */
export class LiftCustomerBanCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LiftCustomerBanInput,
	) {
		super();
	}
}
