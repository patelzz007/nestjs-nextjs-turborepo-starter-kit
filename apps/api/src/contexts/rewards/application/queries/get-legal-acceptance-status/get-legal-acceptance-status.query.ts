import { Query } from "@nestjs/cqrs";
import type { RewardClaimCheckoutStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /legal/status`: the signed-in customer's own status. */
export class GetLegalAcceptanceStatusQuery extends Query<RewardClaimCheckoutStatus> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
