import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ClaimExpiryResult } from "../../services/claim-expiry.application-service";

/** Expire overdue consumer claims (BullMQ `claimsExpirePending`). */
export class ExpireOverdueClaimsCommand extends Command<ClaimExpiryResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
