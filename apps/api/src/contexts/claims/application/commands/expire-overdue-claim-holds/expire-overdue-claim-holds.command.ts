import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ClaimExpiryResult } from "../../services/claim-expiry.application-service";

/** End overdue claim holds and give their units back (BullMQ `claimsExpireHolds`). */
export class ExpireOverdueClaimHoldsCommand extends Command<ClaimExpiryResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
