import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ClaimExpiryResult } from "../../services/claim-expiry.application-service";

/** Expire overdue referrer-credit claims (BullMQ `claimsExpireReferrer`). */
export class ExpireOverdueReferrerClaimsCommand extends Command<ClaimExpiryResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
