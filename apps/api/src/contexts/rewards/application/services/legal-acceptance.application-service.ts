import { Inject, Injectable } from "@nestjs/common";
import type { RewardClaimCheckoutStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { actingUserId } from "../commands/acting-user";
import type { LegalAcceptanceReadPort } from "../ports/reward-read.port";
import { LEGAL_ACCEPTANCE_READS } from "../ports/rewards.tokens";

/** Whether the signed-in customer has accepted the current claim terms (ADR 096); the caller is the scope, never input. */
@Injectable()
export class LegalAcceptanceApplicationService {
	public constructor(@Inject(LEGAL_ACCEPTANCE_READS) private readonly legal: LegalAcceptanceReadPort) {}

	public async checkoutStatus(actor: ActorContext): Promise<RewardClaimCheckoutStatus> {
		return this.legal.checkoutStatus(actor, actingUserId(actor));
	}
}
