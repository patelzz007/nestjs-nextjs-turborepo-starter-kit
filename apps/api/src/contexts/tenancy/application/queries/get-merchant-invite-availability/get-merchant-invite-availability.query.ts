import { Query } from "@nestjs/cqrs";
import type { AdminMerchantInviteAvailability } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Whether this deployment may invite a new merchant (a single-tenant deployment may not). */
export class GetMerchantInviteAvailabilityQuery extends Query<AdminMerchantInviteAvailability> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
