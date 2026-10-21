import { Command } from "@nestjs/cqrs";
import type { TenantCustomerBanResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface BanCustomerInput {
	readonly tenantSlug: string;
	readonly redemptionId: string;
	readonly reason: string;
}

/** A merchant bans the customer behind one of its redemptions from its rewards. */
export class BanCustomerCommand extends Command<TenantCustomerBanResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: BanCustomerInput,
	) {
		super();
	}
}
